import DataLoader from 'dataloader';
import { inArray } from 'drizzle-orm';
import type { DB } from '../db/client.js';
import { venues, type VenueRow } from '../db/schema.js';

export function createLoaders(db: DB) {
  const venueById = new DataLoader<string, VenueRow>(async (ids) => {
    const rows = await db.select().from(venues).where(inArray(venues.id, [...ids]));
    const byId = new Map(rows.map((row) => [row.id, row]));
    return ids.map((id) => byId.get(id) ?? new Error(`Venue ${id} not found`));
  });
  return { venueById };
}

export type Loaders = ReturnType<typeof createLoaders>;
