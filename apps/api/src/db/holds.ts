import { and, eq, gt, inArray, sql } from 'drizzle-orm';
import type { DB } from './client.js';
import { events, eventSeats, holds } from './schema.js';

/** Most seats one hold can contain. The web app's MAX_PICKS matches it. */
export const MAX_SEATS_PER_HOLD = 8;

/** How long a hold lasts. */
export const HOLD_SECONDS = 10 * 60;

export type HoldSeatsOutcome =
  | { kind: 'held'; holdId: string; expiresAt: Date; seatIds: string[] }
  /** Some seats were sold or in someone's active hold. Nothing was held. */
  | { kind: 'unavailable'; seatIds: string[] }
  | { kind: 'event_not_found' }
  | { kind: 'event_not_on_sale' }
  /** This person already has an active hold on this event. */
  | { kind: 'already_holding' }
  /** Some ids aren't seats of this event. */
  | { kind: 'unknown_seats'; seatIds: string[] };

/**
 * Holds `seatIds` for `userId`, all or nothing, so that no seat can ever end up in two
 * holds. Expects at most MAX_SEATS_PER_HOLD distinct ids; the caller checks that.
 *
 * Why the locks: checking "are these seats free?" and then writing the hold are two
 * steps. Without locks, two requests can both check, both see the seat free, and both
 * write. SELECT ... FOR UPDATE makes the second request wait at the check until the
 * first commits, and then it sees the seat as taken.
 */
export function holdSeats(
  db: DB,
  { userId, eventId, seatIds }: { userId: string; eventId: string; seatIds: string[] },
): Promise<HoldSeatsOutcome> {
  return db.transaction(async (tx) => {
    const [event] = await tx.select({ status: events.status }).from(events).where(eq(events.id, eventId));
    if (!event) return { kind: 'event_not_found' };
    if (event.status !== 'on_sale') return { kind: 'event_not_on_sale' };

    // One active hold per person per event. Two requests from the same person (a double
    // click with different seats) would lock different seat rows, so neither would wait
    // for the other, and both could pass the check below. This lock is on the pair
    // (person, event) instead, so those requests take turns. It's released at commit.
    await tx.execute(sql`select pg_advisory_xact_lock(hashtextextended(${`hold:${userId}:${eventId}`}, 0))`);
    const [existing] = await tx
      .select({ id: holds.id })
      .from(holds)
      .where(and(eq(holds.userId, userId), eq(holds.eventId, eventId), gt(holds.expiresAt, sql`now()`)))
      .limit(1);
    if (existing) return { kind: 'already_holding' };

    // Lock the seat rows. Always in id order: if two requests want overlapping seats and
    // locked them in different orders, each could end up waiting for a row the other
    // holds (a deadlock). With one order, one of them simply goes first.
    //
    // This deliberately doesn't join holds to ask "is the seat's hold active?" in the
    // same statement. A statement that had to wait for a lock still uses the snapshot it
    // started with for other tables, so it wouldn't see a hold the other request just
    // created, and the seat would look free. The next statement takes a fresh snapshot.
    const locked = await tx
      .select({ id: eventSeats.id, status: eventSeats.status, holdId: eventSeats.holdId })
      .from(eventSeats)
      .where(and(eq(eventSeats.eventId, eventId), inArray(eventSeats.id, seatIds)))
      .orderBy(eventSeats.id)
      .for('update');

    if (locked.length !== seatIds.length) {
      const found = new Set(locked.map((seat) => seat.id));
      return { kind: 'unknown_seats', seatIds: seatIds.filter((id) => !found.has(id)) };
    }

    // Which of those seats' holds are still active. now() is the database's clock.
    const holdIds = [...new Set(locked.flatMap((seat) => (seat.holdId ? [seat.holdId] : [])))];
    const activeHoldIds = new Set(
      holdIds.length === 0
        ? []
        : (
            await tx
              .select({ id: holds.id })
              .from(holds)
              .where(and(inArray(holds.id, holdIds), gt(holds.expiresAt, sql`now()`)))
          ).map((hold) => hold.id),
    );

    const unavailable = locked
      .filter((seat) => seat.status === 'sold' || (seat.holdId !== null && activeHoldIds.has(seat.holdId)))
      .map((seat) => seat.id);
    // Returning (not throwing) commits a transaction that wrote nothing, which releases
    // the locks just the same.
    if (unavailable.length > 0) return { kind: 'unavailable', seatIds: unavailable };

    const [hold] = await tx
      .insert(holds)
      .values({ userId, eventId, expiresAt: sql`now() + make_interval(secs => ${HOLD_SECONDS})` })
      .returning({ id: holds.id, expiresAt: holds.expiresAt });
    if (!hold) throw new Error('Insert returned no hold');

    // Overwrites any expired hold's id: an expired hold no longer owns its seats.
    await tx.update(eventSeats).set({ holdId: hold.id }).where(inArray(eventSeats.id, seatIds));

    return { kind: 'held', holdId: hold.id, expiresAt: hold.expiresAt, seatIds };
  });
}
