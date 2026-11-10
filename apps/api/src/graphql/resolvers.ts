import { GraphQLError } from "graphql";
import { DateTimeResolver } from "graphql-scalars";
import { and, asc, eq, getTableColumns, sql, type SQL } from "drizzle-orm";
import type { Resolvers } from "../generated/graphql.js";
import { checkHealth } from "../health.js";
import { events, eventSeats, seats, sections, venues } from "../db/schema.js";
import { decodeCursor, encodeCursor } from "./cursor.js";

/** Largest page a client can ask for, so one request can't pull the whole table. */
const MAX_PAGE_SIZE = 50;

// `Resolvers` is generated from schema.graphql, so TypeScript will flag any resolver
// that doesn't match the schema. Add a field to the schema, run `pnpm codegen`,
// and the compiler tells you which resolver to write.
export const resolvers: Resolvers = {
  DateTime: DateTimeResolver,

  // Translate between GraphQL enum names and the lowercase values stored in Postgres.
  EventStatus: {
    SCHEDULED: "scheduled",
    ON_SALE: "on_sale",
    SOLD_OUT: "sold_out",
    CANCELLED: "cancelled",
  },
  SeatStatus: { AVAILABLE: "available", HELD: "held", SOLD: "sold" },

  Query: {
    health: () => checkHealth(),
    event: async (_parent, { id }, { db }) => {
      const [row] = await db
        .select()
        .from(events)
        .where(eq(events.id, id))
        .limit(1);
      return row ?? null;
    },
    // Keyset (cursor) pagination. Each page asks for "the next `first` events after
    // this position", never "skip N rows", so it stays fast however deep you page and
    // can't repeat or skip an event when events are added or removed between pages.
    events: async (_parent, { first, after, city }, { db }) => {
      if (first < 1 || first > MAX_PAGE_SIZE) {
        throw new GraphQLError(`first must be between 1 and ${MAX_PAGE_SIZE}`, {
          extensions: { code: "BAD_USER_INPUT", argumentName: "first" },
        });
      }

      const conditions: SQL[] = [];
      if (city) {
        conditions.push(eq(venues.city, city));
      }

      if (after) {
        const position = decodeCursor(after); // throws BAD_USER_INPUT on a bad cursor
        // Row comparison: true when the event sorts after the cursor in
        // (starts_at, id) order, the same order as orderBy below. It means
        // starts_at > x OR (starts_at = x AND id > y), in a form Postgres can answer
        // straight from an index on (starts_at, id). Drizzle has no helper for
        // comparing two columns at once, so it's a sql template. The ${...} values
        // become query parameters, never pasted-in text, so this is safe from SQL
        // injection. The casts tell Postgres the types of the two parameters.
        conditions.push(
          sql`(${events.startsAt}, ${events.id}) > (${position.startsAt.toISOString()}::timestamptz, ${position.id}::uuid)`,
        );
      }

      const rows = await db
        // Only the event's columns, so each row is a plain EventRow (a bare select()
        // after a join returns { events, venues } objects instead).
        .select(getTableColumns(events))
        .from(events)
        // The join is for the city filter: city lives on venues.
        .innerJoin(venues, eq(events.venueId, venues.id))
        // and() skips undefined, and and() with nothing in it means "no filter".
        .where(and(...conditions))
        // id breaks ties between events that start at the same time, so every event
        // has exactly one position. Must match the cursor's (startsAt, id).
        .orderBy(asc(events.startsAt), asc(events.id))
        // One extra row: if it comes back, there's another page after this one.
        .limit(first + 1);

      const hasNextPage = rows.length > first;
      const page = hasNextPage ? rows.slice(0, first) : rows;
      const edges = page.map((row) => ({ cursor: encodeCursor(row), node: row }));

      return {
        edges,
        pageInfo: { hasNextPage, endCursor: edges.at(-1)?.cursor ?? null },
      };
    },

    cities: async (_parent, _args, { db }) => {
      // Can return cities without events, but the UI will handle this case.
      const rows = await db
        .selectDistinct({
          city: venues.city
        })
        .from(venues)
        .orderBy(asc(venues.city));

      return rows.map((row) => row.city);
    },
  },

  Event: {
    venue: async (parent, _args, { db }) => {
      const [row] = await db
        .select()
        .from(venues)
        .where(eq(venues.id, parent.venueId));
      if (!row)
        throw new Error(
          `Event ${parent.id} references missing venue ${parent.venueId}`,
        );
      return row;
    },
    seats: async (parent, _args, { db }) => {
      return await db
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
        .where(eq(eventSeats.eventId, parent.id))
        .orderBy(
          asc(sections.sortOrder),
          asc(seats.rowLabel),
          asc(seats.seatNumber),
        );
    },
  },
};
