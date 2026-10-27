import { and, asc, eq, inArray, sql, type SQL } from 'drizzle-orm';
import { GraphQLError } from 'graphql';
import { DateTimeResolver } from 'graphql-scalars';
import { events, eventSeats, seats, sections, venues } from '../db/schema.js';
import type { Resolvers } from '../generated/graphql.js';
import { cached } from '../redis.js';

type Cursor = { startsAt: string; id: string };

// Cursors are opaque to clients: base64url-encoded JSON of the sort key.
const encodeCursor = (c: Cursor) => Buffer.from(JSON.stringify(c)).toString('base64url');

function decodeCursor(value: string): Cursor {
  try {
    const parsed = JSON.parse(Buffer.from(value, 'base64url').toString('utf8')) as Cursor;
    if (typeof parsed.startsAt !== 'string' || typeof parsed.id !== 'string') throw new Error();
    return parsed;
  } catch {
    throw new GraphQLError('Invalid cursor', { extensions: { code: 'BAD_USER_INPUT' } });
  }
}

export const resolvers: Resolvers = {
  DateTime: DateTimeResolver,

  // Translate between GraphQL enum names and the lowercase values stored in Postgres.
  EventStatus: { SCHEDULED: 'scheduled', ON_SALE: 'on_sale', SOLD_OUT: 'sold_out', CANCELLED: 'cancelled' },
  SeatStatus: { AVAILABLE: 'available', HELD: 'held', SOLD: 'sold' },

  Query: {
    /*
     * Keyset (cursor) pagination. Instead of OFFSET, which scans and discards rows, we
     * ask for rows that sort after the last one the client saw:
     *   WHERE (starts_at, id) > ($cursorStartsAt, $cursorId) ORDER BY starts_at, id
     * The row-value comparison uses the composite index events_starts_at_id_idx.
     */
    events: async (_parent, { first, after, city }, { db }) => {
      const limit = Math.min(Math.max(first ?? 12, 1), 50);
      const conditions: SQL[] = [];

      if (after) {
        const cursor = decodeCursor(after);
        conditions.push(
          sql`(${events.startsAt}, ${events.id}) > (${cursor.startsAt}::timestamptz, ${cursor.id}::uuid)`,
        );
      }
      if (city) {
        conditions.push(
          inArray(events.venueId, db.select({ id: venues.id }).from(venues).where(eq(venues.city, city))),
        );
      }

      // Fetch one extra row to learn whether another page exists.
      const rows = await db
        .select()
        .from(events)
        .where(and(...conditions))
        .orderBy(asc(events.startsAt), asc(events.id))
        .limit(limit + 1);

      const page = rows.slice(0, limit);
      const edges = page.map((node) => ({
        node,
        cursor: encodeCursor({ startsAt: node.startsAt.toISOString(), id: node.id }),
      }));

      return {
        edges,
        pageInfo: { hasNextPage: rows.length > limit, endCursor: edges.at(-1)?.cursor ?? null },
      };
    },

    event: async (_parent, { id }, { db }) => {
      const [row] = await db.select().from(events).where(eq(events.id, id)).limit(1);
      return row ?? null;
    },

    cities: (_parent, _args, { db }) =>
      cached('cities', 300, async () => {
        const rows = await db.selectDistinct({ city: venues.city }).from(venues).orderBy(asc(venues.city));
        return rows.map((r) => r.city);
      }),
  },

  Event: {
    venue: (event, _args, { loaders }) => loaders.venueById.load(event.venueId),
    availability: (event, _args, { loaders }) => loaders.availabilityByEventId.load(event.id),
    seats: (event, _args, { db }) =>
      db
        .select({
          id: eventSeats.id,
          section: sections.name,
          row: seats.rowLabel,
          number: seats.seatNumber,
          priceCents: eventSeats.priceCents,
          status: eventSeats.status,
        })
        .from(eventSeats)
        .innerJoin(seats, eq(eventSeats.seatId, seats.id))
        .innerJoin(sections, eq(seats.sectionId, sections.id))
        .where(eq(eventSeats.eventId, event.id))
        .orderBy(asc(sections.sortOrder), asc(seats.rowLabel), asc(seats.seatNumber)),
  },
};
