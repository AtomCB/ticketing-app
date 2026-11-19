import { inArray, sql } from "drizzle-orm";
import type { DB } from "./client.js";
import { eventSeats, holds } from "./schema.js";
import { activeHold, isAvailableSql, isHeldSql } from "./seatStatus.js";

/** Seat counts for one event, plus its cheapest seat still on sale. */
export interface Availability {
  total: number;
  available: number;
  held: number;
  sold: number;
  /** Cheapest available seat, or null when nothing is available (sold out or all held). */
  minPriceCents: number | null;
}

/**
 * An event with no seats at all. Frozen because it's one shared object: changing it would
 * change it for every empty event.
 */
export const EMPTY_AVAILABILITY: Readonly<Availability> = Object.freeze({
  total: 0,
  available: 0,
  held: 0,
  sold: 0,
  minPriceCents: null,
});

/**
 * Availability for many events in one query (a count per status, via FILTER). Held
 * means in a hold that hasn't expired (see seatStatus.ts), so an expired hold's seats
 * count as available again straight away.
 *
 * Returns exactly one entry per id, in the same order as `eventIds`, which is what a
 * DataLoader batch function must return. Events with no seats have no rows to group, so
 * they'd be missing from the query result; they get EMPTY_AVAILABILITY here, so no caller
 * has to remember that case.
 */
export async function fetchAvailability(
  db: DB,
  eventIds: readonly string[],
): Promise<Availability[]> {
  if (eventIds.length === 0) return [];

  const rows = await db
    .select({
      eventId: eventSeats.eventId,
      // count(*) is a bigint, which the pg driver returns as a string; ::int makes it a number.
      total: sql<number>`count(*)::int`,
      available: sql<number>`count(*) filter (where ${isAvailableSql})::int`,
      held: sql<number>`count(*) filter (where ${isHeldSql})::int`,
      sold: sql<number>`count(*) filter (where ${eventSeats.status} = 'sold')::int`,
      // min() keeps the column's type (integer), so no cast; null when no seat passes the filter.
      minPriceCents: sql<number | null>`min(${eventSeats.priceCents}) filter (where ${isAvailableSql})`,
    })
    .from(eventSeats)
    .leftJoin(holds, activeHold)
    .where(inArray(eventSeats.eventId, [...eventIds]))
    .groupBy(eventSeats.eventId);

  const byId = new Map(rows.map(({ eventId, ...availability }) => [eventId, availability]));
  return eventIds.map((id) => byId.get(id) ?? EMPTY_AVAILABILITY);
}
