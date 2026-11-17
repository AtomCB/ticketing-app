import DataLoader from 'dataloader';
import { inArray } from 'drizzle-orm';
import type { DB } from '../db/client.js';
import type { Redis } from 'ioredis';
import { venues, type VenueRow } from '../db/schema.js';
import { fetchAvailability, type Availability } from '../db/availability.js';
import { cacheAside } from '../cache.js';

/**
 * Availability is cached briefly: fine for "98 seats left" on a list, which can be up to
 * this many seconds out of date. Never use it to decide whether a seat can be held.
 */
const AVAILABILITY_TTL_SECONDS = 10;

/** Starts with `event:`, so the seed's SCAN for `event:*` clears it. Exported for invalidation. */
export const availabilityKey = (eventId: string) => `event:${eventId}:availability`;

export function createLoaders(db: DB, redis: Redis) {
  const venueById = new DataLoader<string, VenueRow>(async (ids) => {
    const rows = await db.select().from(venues).where(inArray(venues.id, [...ids]));
    const byId = new Map(rows.map((row) => [row.id, row]));
    return ids.map((id) => byId.get(id) ?? new Error(`Venue ${id} not found`));
  });

  // One MGET for the whole page, then one SQL query for whatever wasn't cached.
  const availabilityByEventId = new DataLoader<string, Availability>((ids) =>
    cacheAside(redis, ids, {
      key: availabilityKey,
      ttlSeconds: AVAILABILITY_TTL_SECONDS,
      fetch: (missIds) => fetchAvailability(db, missIds),
    }),
  );

  return { availabilityByEventId, venueById };
}

export type Loaders = ReturnType<typeof createLoaders>;
