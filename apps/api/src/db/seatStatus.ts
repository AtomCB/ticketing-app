import { and, eq, gt, sql } from 'drizzle-orm';
import { eventSeats, holds } from './schema.js';

/**
 * A seat is held while event_seats.hold_id points at a hold that hasn't expired. That's
 * the only record of it: there's no 'held' status to keep in step, so an expired hold
 * stops counting the moment it expires, with no background job involved.
 *
 * Every query that cares whether a seat is held left-joins holds on this condition:
 *
 *   db.select({ status: seatStatusSql }).from(eventSeats).leftJoin(holds, activeHold)
 *
 * After the join, holds.id is set only when the seat is in an active hold. now() is the
 * database's clock, so every API server agrees on when a hold ends.
 */
export const activeHold = and(eq(holds.id, eventSeats.holdId), gt(holds.expiresAt, sql`now()`));

/** A seat's status as the API reports it: the stored status plus whether it's held. */
export type SeatStatus = 'available' | 'held' | 'sold';

/** True for a seat that's in an active hold and not sold. Needs the activeHold join. */
export const isHeldSql = sql<boolean>`(${eventSeats.status} = 'available' and ${holds.id} is not null)`;

/** True for a seat someone could hold right now. Needs the activeHold join. */
export const isAvailableSql = sql<boolean>`(${eventSeats.status} = 'available' and ${holds.id} is null)`;

/** The seat's SeatStatus, worked out in SQL. Needs the activeHold join. Sold wins. */
export const seatStatusSql = sql<SeatStatus>`case
  when ${eventSeats.status} = 'sold' then 'sold'
  when ${holds.id} is not null then 'held'
  else 'available'
end`;
