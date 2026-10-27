import DataLoader from 'dataloader';
import { inArray, sql } from 'drizzle-orm';
import type { DB } from '../db/client.js';
import { eventSeats, venues, type VenueRow } from '../db/schema.js';
import { redis } from '../redis.js';

export type AvailabilitySummary = {
  total: number;
  available: number;
  held: number;
  sold: number;
  minPriceCents: number | null;
};

const AVAILABILITY_TTL_SECONDS = 10;
export const availabilityKey = (eventId: string) => `event:${eventId}:availability`;

/**
 * DataLoaders batch every `.load(id)` call made during one tick into a single query.
 * Without them, a page of 12 events would run 12 separate venue lookups (the N+1 problem).
 * A fresh set is created per request so cached values never leak between users.
 */
export function createLoaders(db: DB) {
  return {
    venueById: new DataLoader<string, VenueRow>(async (ids) => {
      const rows = await db.select().from(venues).where(inArray(venues.id, [...ids]));
      const byId = new Map(rows.map((row) => [row.id, row]));
      return ids.map((id) => byId.get(id) ?? new Error(`Venue ${id} not found`));
    }),

    // Batches Redis too: one MGET for the whole page, then one SQL query for the misses.
    availabilityByEventId: new DataLoader<string, AvailabilitySummary>(async (ids) => {
      const results = new Map<string, AvailabilitySummary>();

      try {
        const cachedValues = await redis.mget(ids.map(availabilityKey));
        cachedValues.forEach((value, i) => {
          if (value !== null) results.set(ids[i]!, JSON.parse(value) as AvailabilitySummary);
        });
      } catch (err) {
        console.warn('[redis] availability read failed:', (err as Error).message);
      }

      const misses = ids.filter((id) => !results.has(id));
      if (misses.length > 0) {
        // FILTER (WHERE ...) computes several conditional aggregates in one pass over the rows.
        const rows = await db
          .select({
            eventId: eventSeats.eventId,
            total: sql<number>`count(*)::int`,
            available: sql<number>`(count(*) filter (where ${eventSeats.status} = 'available'))::int`,
            held: sql<number>`(count(*) filter (where ${eventSeats.status} = 'held'))::int`,
            sold: sql<number>`(count(*) filter (where ${eventSeats.status} = 'sold'))::int`,
            minPriceCents: sql<
              number | null
            >`min(${eventSeats.priceCents}) filter (where ${eventSeats.status} = 'available')`,
          })
          .from(eventSeats)
          .where(inArray(eventSeats.eventId, misses))
          .groupBy(eventSeats.eventId);

        const pipeline = redis.pipeline();
        for (const id of misses) {
          const row = rows.find((r) => r.eventId === id);
          const summary: AvailabilitySummary = row
            ? { total: row.total, available: row.available, held: row.held, sold: row.sold, minPriceCents: row.minPriceCents }
            : { total: 0, available: 0, held: 0, sold: 0, minPriceCents: null };
          results.set(id, summary);
          pipeline.set(availabilityKey(id), JSON.stringify(summary), 'EX', AVAILABILITY_TTL_SECONDS);
        }
        await pipeline.exec().catch((err: Error) => {
          console.warn('[redis] availability write failed:', err.message);
        });
      }

      return ids.map((id) => results.get(id)!);
    }),
  };
}

export type Loaders = ReturnType<typeof createLoaders>;
