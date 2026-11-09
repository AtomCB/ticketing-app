/*
 * Your database schema lives here. Drizzle reads this file to generate SQL migrations.
 *
 * Workflow:
 *   1. Define tables in this file with pgTable(...)
 *   2. pnpm db:generate   -> writes a SQL migration to apps/api/drizzle/
 *   3. Read that SQL file. This is the Postgres you're learning.
 *   4. pnpm db:migrate    -> applies it
 *
 * Start with BUILD_PLAN.md, milestone 1.
 * Docs: https://orm.drizzle.team/docs/sql-schema-declaration
 */

import { sql } from "drizzle-orm";
import {
  check,
  index,
  integer,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

/*
  Data Model

  venues <- sections <- seats  (physical location)
    ^                    |
    |                    |
    |- events <----- event_seats
*/

export const eventStatus = pgEnum("event_status", [
  "scheduled",
  "on_sale",
  "sold_out",
  "cancelled",
]);

export const seatStatus = pgEnum("seat_status", ["available", "held", "sold"]);

export const venues = pgTable("venues", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  city: text("city").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

export const sections = pgTable(
  "sections",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    venueId: uuid("venue_id")
      .notNull()
      .references(() => venues.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    sortOrder: integer("sort_order").notNull().default(0),
  },
  (t) => [uniqueIndex("sections_venue_name_uq").on(t.venueId, t.name)],
);

export const seats = pgTable(
  "seats",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    sectionId: uuid("section_id")
      .notNull()
      .references(() => sections.id, { onDelete: "cascade" }),
    rowLabel: text("row_label").notNull(),
    seatNumber: integer("seat_number").notNull(),
  },
  (t) => [
    uniqueIndex("seats_section_row_number_uq").on(
      t.sectionId,
      t.rowLabel,
      t.seatNumber,
    ),
  ],
);

export const events = pgTable(
  "events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    // 'restrict' blocks deletion of venue if there are events.
    venueId: uuid("venue_id")
      .notNull()
      .references(() => venues.id, { onDelete: "restrict" }),
    name: text("name").notNull(),
    description: text("description").notNull().default(""),
    startsAt: timestamp("starts_at", { withTimezone: true }).notNull(),
    status: eventStatus("status").notNull().default("scheduled"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    // Composite index that backs keyset pagination: ORDER BY starts_at, id
    index("events_starts_at_id_idx").on(t.startsAt, t.id),
    index("events_venue_id_idx").on(t.venueId),
  ],
);

export const eventSeats = pgTable(
  "event_seats",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    eventId: uuid("event_id")
      .notNull()
      .references(() => events.id, { onDelete: "cascade" }),
    seatId: uuid("seat_id")
      .notNull()
      .references(() => seats.id, { onDelete: "restrict" }),
    priceCents: integer("price_cents").notNull(),
    status: seatStatus("status").notNull().default("available"),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => [
    // A seat can only be sold once per event. This is the database's last line of
    // defense against double-booking, whatever the application code does.
    uniqueIndex("event_seats_event_seat_uq").on(t.eventId, t.seatId),
    // Add composite index to speed up queries by seat status for an event.
    index("event_seats_event_status_idx").on(t.eventId, t.status),
    check("event_seats_price_positive", sql`${t.priceCents} > 0`),
  ],
);

export type VenueRow = typeof venues.$inferSelect;
export type EventRow = typeof events.$inferSelect;
export type EventStatus = (typeof eventStatus.enumValues)[number];
export type EventSeatStatus = (typeof seatStatus.enumValues)[number];
