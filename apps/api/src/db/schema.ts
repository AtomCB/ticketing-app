/*
 * Your database schema lives here. Drizzle reads this file to generate SQL migrations.
 *
 * Workflow:
 *   1. Define tables in this file with pgTable(...)
 *   2. pnpm db:generate   -> writes a SQL migration to apps/api/drizzle/
 *   3. Read that SQL file. This is the Postgres you're learning.
 *   4. pnpm db:migrate    -> applies it
 *
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
         ^               |
         |               v  hold_id, while the seat is held
         |----------- holds -----> users
*/

export const eventStatus = pgEnum("event_status", [
  "scheduled",
  "on_sale",
  "sold_out",
  "cancelled",
]);

// Whether a seat can still be sold at all. Being held isn't stored here: a seat is held
// while its hold_id points at a hold that hasn't expired (see db/seatStatus.ts), so an
// expired hold frees its seats the moment it expires, with nothing to clean up.
export const seatStatus = pgEnum("seat_status", ["available", "sold"]);

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
    // The hold this seat is in, if any. Deleting a hold frees its seats.
    holdId: uuid("hold_id").references(() => holds.id, { onDelete: "set null" }),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => [
    // Each physical seat appears once per event, so there's exactly one row to lock and
    // update for it. (Two people can't hold or buy the same seat because holdSeats locks
    // that row with SELECT ... FOR UPDATE; this index is what makes "that row" unique.)
    uniqueIndex("event_seats_event_seat_uq").on(t.eventId, t.seatId),
    // Seat counts by status for an event.
    index("event_seats_event_status_idx").on(t.eventId, t.status),
    // Finding a hold's seats, and what Postgres scans when a hold is deleted. Partial:
    // most seats are in no hold, so leaving the nulls out keeps the index small.
    index("event_seats_hold_id_idx").on(t.holdId).where(sql`${t.holdId} is not null`),
    check("event_seats_price_positive", sql`${t.priceCents} > 0`),
  ],
);

export const users = pgTable(
  "users",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    email: text("email").notNull(),
    passwordHash: text("password_hash").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    // Case-insensitive: Adam@Example.com and adam@example.com are one account.
    uniqueIndex("users_email_lower_uq").on(sql`lower(${t.email})`),
  ],
);

/**
 * A person's claim on some seats for a few minutes while they check out. The seats point
 * here through event_seats.hold_id. A hold whose expires_at has passed counts as no hold.
 */
export const holds = pgTable(
  "holds",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    eventId: uuid("event_id")
      .notNull()
      .references(() => events.id, { onDelete: "cascade" }),
    // No default: holdSeats sets it from the database clock (now() + the hold length),
    // so every server agrees on when a hold ends, and the length can differ per
    // environment (30 seconds in development for milestone 11).
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    // "Does this person already have a hold on this event?" (one active hold each).
    index("holds_user_event_idx").on(t.userId, t.eventId),
    check("holds_expires_after_created", sql`${t.expiresAt} > ${t.createdAt}`),
  ],
);

export type VenueRow = typeof venues.$inferSelect;
export type EventRow = typeof events.$inferSelect;
export type EventStatus = (typeof eventStatus.enumValues)[number];
/** The stored status: available or sold. For held seats too, see db/seatStatus.ts. */
export type EventSeatStatus = (typeof seatStatus.enumValues)[number];
export type UserRow = typeof users.$inferSelect;
export type HoldRow = typeof holds.$inferSelect;
