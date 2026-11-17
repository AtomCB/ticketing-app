import DataLoader from 'dataloader';
import { inArray } from 'drizzle-orm';
import type { DB } from '../db/client.js';
import { venues, type VenueRow } from '../db/schema.js';
import { fetchAvailability, type Availability } from '../db/availability.js';

export function createLoaders(db: DB) {
  const venueById = new DataLoader<string, VenueRow>(async (ids) => {
    const rows = await db.select().from(venues).where(inArray(venues.id, [...ids]));
    const byId = new Map(rows.map((row) => [row.id, row]));
    return ids.map((id) => byId.get(id) ?? new Error(`Venue ${id} not found`));
  });

  // fetchAvailability already returns one entry per id, in order (empty events included),
  // so it can be the batch function as-is.
  const availabilityByEventId = new DataLoader<string, Availability>((ids) =>
    fetchAvailability(db, ids),
  );

  return { availabilityByEventId, venueById };
}

export type Loaders = ReturnType<typeof createLoaders>;
