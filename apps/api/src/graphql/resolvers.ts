import { DateTimeResolver } from "graphql-scalars";
import type { Resolvers } from "../generated/graphql.js";
import { checkHealth } from "../health.js";
import { events, eventSeats, seats, sections, venues } from "../db/schema.js";
import { asc, eq } from "drizzle-orm";

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
    events: async (_parent, { limit }, { db }) => {
      return await db.select().from(events).orderBy(asc(events.startsAt), asc(events.id)).limit(limit);
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
