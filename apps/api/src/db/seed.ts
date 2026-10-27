/**
 * Resets the database to a known set of venues, events and seat inventory.
 * Run with `pnpm db:seed`. Safe to run repeatedly; it wipes existing data first.
 */
import { sql } from 'drizzle-orm';
import { Redis } from 'ioredis';
import { env } from '../env.js';
import { db, pool } from './client.js';
import { events, eventSeats, seats, sections, venues } from './schema.js';

// Small deterministic PRNG so every seed produces the same "sold" seats.
function mulberry32(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const random = mulberry32(42);

type SectionSpec = { name: string; rows: number; seatsPerRow: number; basePriceCents: number };

const VENUES: { name: string; city: string; sections: SectionSpec[] }[] = [
  {
    name: 'The Larkspur',
    city: 'Chicago',
    sections: [
      { name: 'Floor', rows: 6, seatsPerRow: 14, basePriceCents: 8900 },
      { name: 'Mezzanine', rows: 4, seatsPerRow: 16, basePriceCents: 6200 },
      { name: 'Balcony', rows: 4, seatsPerRow: 18, basePriceCents: 3900 },
    ],
  },
  {
    name: 'Harbor Pavilion',
    city: 'Seattle',
    sections: [
      { name: 'Orchestra', rows: 7, seatsPerRow: 16, basePriceCents: 7500 },
      { name: 'Terrace', rows: 5, seatsPerRow: 20, basePriceCents: 4500 },
    ],
  },
  {
    name: 'Union Hall',
    city: 'Austin',
    sections: [
      { name: 'Front', rows: 3, seatsPerRow: 10, basePriceCents: 6500 },
      { name: 'Main', rows: 6, seatsPerRow: 12, basePriceCents: 4200 },
      { name: 'Rear', rows: 3, seatsPerRow: 14, basePriceCents: 2800 },
    ],
  },
];

const EVENTS: {
  name: string;
  description: string;
  venue: string;
  daysFromNow: number;
  hour: number;
  priceMultiplier: number;
  soldRatio: number;
  status: 'scheduled' | 'on_sale' | 'sold_out';
}[] = [
  { name: 'Marlow & The Night Shift', description: 'A two-hour set of late-night soul from the Detroit nine-piece, touring their third record.', venue: 'The Larkspur', daysFromNow: 6, hour: 20, priceMultiplier: 1.2, soldRatio: 0.55, status: 'on_sale' },
  { name: 'Open Mic Gone Wrong', description: 'Five comics, one broken microphone and a strict no-phones policy.', venue: 'Union Hall', daysFromNow: 9, hour: 21, priceMultiplier: 0.8, soldRatio: 0.3, status: 'on_sale' },
  { name: 'Cascadia Chamber Orchestra: Winter Program', description: 'Sibelius, Pärt and a new commission by a Seattle composer.', venue: 'Harbor Pavilion', daysFromNow: 13, hour: 19, priceMultiplier: 1, soldRatio: 0.4, status: 'on_sale' },
  { name: 'Paper Lanterns', description: 'Dream-pop trio with a full visual show. All ages.', venue: 'Union Hall', daysFromNow: 17, hour: 20, priceMultiplier: 1, soldRatio: 1, status: 'sold_out' },
  { name: 'The Ninth Inning: A Baseball Musical', description: 'A minor-league team, one last season, eleven original songs.', venue: 'The Larkspur', daysFromNow: 22, hour: 19, priceMultiplier: 1.4, soldRatio: 0.2, status: 'on_sale' },
  { name: 'Dana Okafor: Long Story Short', description: 'An evening of storytelling from the host of the radio show of the same name.', venue: 'Harbor Pavilion', daysFromNow: 30, hour: 20, priceMultiplier: 0.9, soldRatio: 0.1, status: 'on_sale' },
  { name: 'Brass Against the Machine Shop', description: 'A twelve-piece brass band plays industrial rock. Earplugs recommended.', venue: 'The Larkspur', daysFromNow: 41, hour: 21, priceMultiplier: 1, soldRatio: 0, status: 'scheduled' },
  { name: 'Lowland Folk Festival: Night One', description: 'Six acts across one long evening, with a square-dance interval.', venue: 'Union Hall', daysFromNow: 55, hour: 18, priceMultiplier: 1.1, soldRatio: 0.05, status: 'on_sale' },
];

const ROW_LABELS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';

function startsAt(daysFromNow: number, hour: number) {
  const d = new Date();
  d.setDate(d.getDate() + daysFromNow);
  d.setHours(hour, 0, 0, 0);
  return d;
}

async function seed() {
  console.log('Seeding database…');

  await db.transaction(async (tx) => {
    await tx.execute(sql`truncate table event_seats, events, seats, sections, venues restart identity cascade`);

    const venueIds = new Map<string, string>();
    // seat ids per venue, with each seat's section base price
    const venueSeats = new Map<string, { seatId: string; basePriceCents: number }[]>();

    for (const venueSpec of VENUES) {
      const [venue] = await tx
        .insert(venues)
        .values({ name: venueSpec.name, city: venueSpec.city })
        .returning({ id: venues.id });
      venueIds.set(venueSpec.name, venue!.id);
      const seatList: { seatId: string; basePriceCents: number }[] = [];

      for (const [sortOrder, sectionSpec] of venueSpec.sections.entries()) {
        const [section] = await tx
          .insert(sections)
          .values({ venueId: venue!.id, name: sectionSpec.name, sortOrder })
          .returning({ id: sections.id });

        const seatValues = Array.from({ length: sectionSpec.rows }, (_, r) =>
          Array.from({ length: sectionSpec.seatsPerRow }, (_, n) => ({
            sectionId: section!.id,
            rowLabel: ROW_LABELS[r]!,
            seatNumber: n + 1,
          })),
        ).flat();

        const inserted = await tx.insert(seats).values(seatValues).returning({ id: seats.id });
        seatList.push(...inserted.map((s) => ({ seatId: s.id, basePriceCents: sectionSpec.basePriceCents })));
      }
      venueSeats.set(venueSpec.name, seatList);
    }

    for (const eventSpec of EVENTS) {
      const [event] = await tx
        .insert(events)
        .values({
          venueId: venueIds.get(eventSpec.venue)!,
          name: eventSpec.name,
          description: eventSpec.description,
          startsAt: startsAt(eventSpec.daysFromNow, eventSpec.hour),
          status: eventSpec.status,
        })
        .returning({ id: events.id });

      const inventory = venueSeats.get(eventSpec.venue)!.map(({ seatId, basePriceCents }) => ({
        eventId: event!.id,
        seatId,
        // Round to the nearest dollar so prices look like real ticket prices.
        priceCents: Math.round((basePriceCents * eventSpec.priceMultiplier) / 100) * 100,
        status: random() < eventSpec.soldRatio ? ('sold' as const) : ('available' as const),
      }));
      await tx.insert(eventSeats).values(inventory);
    }
  });

  const [counts] = await db.execute<{ venues: number; events: number; event_seats: number }>(sql`
    select
      (select count(*)::int from venues) as venues,
      (select count(*)::int from events) as events,
      (select count(*)::int from event_seats) as event_seats
  `).then((r) => r.rows);
  console.log(`Seeded ${counts!.venues} venues, ${counts!.events} events, ${counts!.event_seats} event seats.`);

  // Cached availability would now be stale, so clear it.
  const redis = new Redis(env.REDIS_URL, { maxRetriesPerRequest: 1, lazyConnect: true });
  try {
    await redis.connect();
    // SCAN walks the keyspace in small batches. Avoid KEYS in real apps: it blocks Redis.
    const keys = ['cities'];
    for await (const batch of redis.scanStream({ match: 'event:*', count: 500 })) {
      keys.push(...(batch as string[]));
    }
    await redis.del(...keys);
    console.log(`Cleared the Redis cache (${keys.length} ${keys.length === 1 ? 'key' : 'keys'}).`);
  } catch (err) {
    console.warn('Could not clear the Redis cache:', (err as Error).message);
  } finally {
    redis.disconnect();
  }
}

try {
  await seed();
} finally {
  await pool.end();
}
