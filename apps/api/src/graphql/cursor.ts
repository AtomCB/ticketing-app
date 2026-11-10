import { GraphQLError } from 'graphql';

/**
 * Where an event sits in the list order: (startsAt, id). Ordering by startsAt alone
 * isn't enough, because two events can start at the same moment; id breaks the tie,
 * so every event has exactly one position and paging never repeats or skips one.
 */
export interface EventCursor {
  startsAt: Date;
  id: string;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Packs a position into an opaque string: base64url of `["<ISO date>", "<uuid>"]`.
 * Clients only pass it back as `after`; they shouldn't read or build it, which leaves
 * us free to change what's inside later.
 *
 * base64url (not plain base64) so the cursor has no `+`, `/` or `=` and can sit in a
 * URL or query string unescaped.
 *
 * Precision note: JS Dates keep milliseconds, Postgres timestamps keep microseconds.
 * The seed only uses whole minutes so nothing is lost; if events ever had sub-millisecond
 * start times, read starts_at as a string (timestamp mode: 'string') for the cursor.
 */
export function encodeCursor({ startsAt, id }: EventCursor): string {
  return Buffer.from(JSON.stringify([startsAt.toISOString(), id])).toString('base64url');
}

/**
 * Unpacks a cursor from encodeCursor. A cursor comes from the client, so it can be any
 * string at all: a truncated copy, an old format, or something made up. Anything that
 * isn't exactly what encodeCursor produces gets the same clear error, rather than a
 * crash or a query with an Invalid Date in it.
 */
export function decodeCursor(cursor: string): EventCursor {
  try {
    const parsed: unknown = JSON.parse(Buffer.from(cursor, 'base64url').toString('utf8'));

    if (Array.isArray(parsed) && parsed.length === 2) {
      const [iso, id] = parsed;
      if (typeof iso === 'string' && typeof id === 'string' && UUID.test(id)) {
        const startsAt = new Date(iso);
        if (!Number.isNaN(startsAt.getTime())) return { startsAt, id };
      }
    }
  } catch {
    // Not valid JSON once decoded. Falls through to the error below.
  }

  throw new GraphQLError('Invalid cursor. Pass a cursor from a previous page.', {
    // BAD_USER_INPUT is Apollo's code for bad arguments: the client's fault, not the server's.
    extensions: { code: 'BAD_USER_INPUT', argumentName: 'after' },
  });
}
