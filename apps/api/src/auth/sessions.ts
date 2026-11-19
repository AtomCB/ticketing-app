import { randomBytes } from "node:crypto";
import type { CookieOptions, Response } from "express";
import type { Redis } from "ioredis";
import { env } from "../env.js";

/** How long a session lasts without activity. Each authenticated request resets it. */
export const SESSION_TTL_SECONDS = 60 * 60 * 24 * 30; // 30 days

/** Also the cookie's name, so the two can't drift apart. */
export const SESSION_COOKIE = "usher_session";

/** Redis key for a session: `session:<id>` → user id. Never shares the seed's `event:*` keys. */
const sessionKey = (sessionId: string) => `session:${sessionId}`;

/**
 * Starts a session for a signed-in user and returns its id, which goes in the cookie.
 *
 * The id is the only proof of who someone is, so it comes from a secure random source:
 * 32 bytes (256 bits) can't be guessed, and base64url makes it safe in a cookie and a
 * Redis key. The expiry is set in the same command as the value, so a session can never
 * exist without one. NX refuses to overwrite an existing key, so even a (practically
 * impossible) collision can't hand someone else's session out.
 *
 * Throws if Redis is down: unlike the availability cache, there's no fallback, because a
 * session that was never stored would sign the user straight back out.
 */
export async function createSession(redis: Redis, userId: string): Promise<string> {
  const sessionId = randomBytes(32).toString("base64url");

  const created = await redis.set(
    sessionKey(sessionId),
    userId,
    "EX",
    SESSION_TTL_SECONDS,
    "NX",
  );

  if (created !== "OK") throw new Error("Session id collision; try again");

  return sessionId;
}

/**
 * The user id a session belongs to, or null if there's no such session (expired, signed
 * out, or a made-up cookie). A missing session is normal, so it isn't an error: the
 * caller treats the request as signed out.
 *
 * GETEX reads the session and resets its expiry in one atomic command, which is what
 * makes the TTL slide: a session only expires after SESSION_TTL_SECONDS without use.
 */
export async function getSessionUserId(redis: Redis, sessionId: string): Promise<string | null> {
  return await redis.getex(sessionKey(sessionId), "EX", SESSION_TTL_SECONDS);
}

/**
 * Ends a session (signing out). Safe to call when it's already gone, e.g. it expired or
 * the user signed out twice: either way the session no longer exists afterwards.
 */
export async function destroySession(redis: Redis, sessionId: string): Promise<void> {
  await redis.del(sessionKey(sessionId));
}

/**
 * The session cookie's attributes, shared by setting and clearing it: a browser only
 * clears a cookie whose path (and other attributes) match the ones it was set with.
 */
const cookieAttributes: CookieOptions = {
  httpOnly: true, // JavaScript can't read it, so an injected script can't steal it
  sameSite: "lax", // not sent with requests other sites start (most CSRF)
  secure: env.IS_PRODUCTION, // HTTPS only in production; local dev is plain HTTP
  path: "/",
};

/**
 * Sends the session cookie. It lives as long as the session, counted from now; Express
 * wants milliseconds. createContext calls this on every request with a valid session, so
 * the cookie's expiry slides along with the Redis session's.
 */
export function setSessionCookie(res: Response, sessionId: string): void {
  res.cookie(SESSION_COOKIE, sessionId, { ...cookieAttributes, maxAge: SESSION_TTL_SECONDS * 1000 });
}

/** Tells the browser to delete the session cookie (signing out). */
export function clearSessionCookie(res: Response): void {
  res.clearCookie(SESSION_COOKIE, cookieAttributes);
}
