import type { ExpressContextFunctionArgument } from '@as-integrations/express5';
import { parseCookie } from 'cookie';
import { eq } from 'drizzle-orm';
import { GraphQLError } from 'graphql';
import { getSessionUserId, SESSION_COOKIE, setSessionCookie } from '../auth/sessions.js';
import { db, type DB } from '../db/client.js';
import { users, type UserRow } from '../db/schema.js';
import { redis } from '../redis.js';
import { createLoaders, type Loaders } from './loaders.js';

/** The signed-in user as resolvers see it. Never the password hash. */
export type CurrentUser = Pick<UserRow, 'id' | 'email'>;

export type GraphQLContext = {
  db: DB;
  redis: typeof redis;
  loaders: Loaders;
  /** The signed-in user, or null for anyone signed out. */
  user: CurrentUser | null;
  /** The current session's id when `user` is set, so signing out can delete it. */
  sessionId: string | null;
  /** The HTTP response, so sign-in and sign-out can set or clear the session cookie. */
  res: ExpressContextFunctionArgument['res'];
};

// Called once per request. Per-request things belong here: DataLoaders, and the
// signed-in user, read from the session cookie.
export async function createContext({ req, res }: ExpressContextFunctionArgument): Promise<GraphQLContext> {
  const { user, sessionId } = await loadSession(req.headers.cookie);
  // Reading the session just pushed its Redis expiry 30 days out; send the cookie again
  // so it expires then too. Without this the cookie would still run out 30 days after
  // sign-in, signing out someone who uses the app every day. (A signIn or signOut later
  // in this request sets the cookie again, and the browser keeps the last one.)
  if (sessionId) setSessionCookie(res, sessionId);
  return { db, redis, loaders: createLoaders(db, redis), user, sessionId, res };
}

/** What createSession produces: 32 random bytes as base64url. */
const SESSION_ID_FORMAT = /^[A-Za-z0-9_-]{43}$/;

const SIGNED_OUT = { user: null, sessionId: null } as const;

/**
 * Who's making this request. Anything that doesn't lead to a real, current user (no
 * cookie, a malformed one, an expired session, a deleted account) means signed out,
 * never an error: public pages must keep working for everyone.
 */
async function loadSession(
  cookieHeader: string | undefined,
): Promise<{ user: CurrentUser | null; sessionId: string | null }> {
  const sessionId = cookieHeader ? parseCookie(cookieHeader)[SESSION_COOKIE] : undefined;
  // Junk or oversized cookies never reach Redis.
  if (!sessionId || !SESSION_ID_FORMAT.test(sessionId)) return SIGNED_OUT;

  let userId: string | null;
  try {
    userId = await getSessionUserId(redis, sessionId);
  } catch (err) {
    // Redis is down: serve the request as signed out rather than failing it. Browsing
    // still works; anything that needs a user gets UNAUTHENTICATED. (Never log the id:
    // it's a credential.)
    console.warn(`[auth] couldn't read the session, treating as signed out: ${(err as Error).message}`);
    return SIGNED_OUT;
  }
  if (!userId) return SIGNED_OUT;

  const [user] = await db
    .select({ id: users.id, email: users.email })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  return user ? { user, sessionId } : SIGNED_OUT;
}

/**
 * For resolvers that need a signed-in user: returns them, or throws UNAUTHENTICATED.
 *   const user = requireUser(context);
 */
export function requireUser(context: Pick<GraphQLContext, 'user'>): CurrentUser {
  if (!context.user) {
    throw new GraphQLError('You need to sign in to do that.', {
      extensions: { code: 'UNAUTHENTICATED' },
    });
  }
  return context.user;
}
