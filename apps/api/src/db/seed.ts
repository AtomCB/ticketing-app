import { readFileSync } from "node:fs";
import path from "node:path";
import { db, pool } from "./client.js";
import {
  events,
  eventSeats,
  seats,
  sections,
  venues,
  type EventStatus,
} from "./schema.js";
import { sql } from "drizzle-orm";
import { Redis } from "ioredis";
import { env } from "../env.js";

type Venues = {
  name: string;
  city: string;
  sections: {
    name: string;
    rows: number;
    seatsPerRow: number;
    basePriceCents: number;
  }[];
}[];

type Events = {
  name: string;
  description: string;
  venue: string;
  daysFromNow: number;
  hour: number;
  priceMultiplier: number;
  soldRatio: number;
  status: EventStatus;
}[];

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

const ROW_LABELS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";

const data: { _about: string; events: Events; venues: Venues } = JSON.parse(
  readFileSync(path.resolve(import.meta.dirname, "seed-data.json"), "utf8"),
);

// Doesn't handle timezone of venue, but works for seed data.
const getStartDate = (daysFromNow: number, hour: number) => {
  const date = new Date();
  date.setDate(date.getDate() + daysFromNow);
  date.setHours(hour, 0, 0, 0);
  return date;
};

async function seed() {
  console.log(
    `Loaded ${data.venues.length} venues and ${data.events.length} events from seed-data.json.`,
  );

  const VENUES = data.venues;
  const EVENTS = data.events;

  await db.transaction(async (tx) => {
    // Delete everything currently in the DB.
    await tx.execute(
      sql`truncate table event_seats, events, seats, sections, venues restart identity cascade`,
    );

    const venueIds = new Map<string, string>();
    const venueSeats = new Map<
      string,
      { seatId: string; basePriceCents: number }[]
    >();

    // For each venue, insert the venue, sections, seats.
    for (const venueSpec of VENUES) {
      const [venue] = await tx
        .insert(venues)
        .values({ name: venueSpec.name, city: venueSpec.city })
        .returning({ id: venues.id });

      venueIds.set(venueSpec.name, venue!.id);
      const seatList: { seatId: string; basePriceCents: number }[] = [];

      // Insert sections.
      for (const [sortOrder, sectionSpec] of venueSpec.sections.entries()) {
        const [section] = await tx
          .insert(sections)
          .values({ venueId: venue!.id, name: sectionSpec.name, sortOrder })
          .returning({ id: sections.id });

        // Insert seats.
        const seatValues = Array.from(
          { length: sectionSpec.rows },
          (_, rowIdx) =>
            Array.from({ length: sectionSpec.seatsPerRow }, (_, seatIdx) => ({
              sectionId: section!.id,
              rowLabel: ROW_LABELS[rowIdx]!,
              seatNumber: seatIdx + 1,
            })),
        ).flat();
        const sectionSeatIds = await tx
          .insert(seats)
          .values(seatValues)
          .returning({ id: seats.id });
        seatList.push(
          ...sectionSeatIds.map((s) => ({
            seatId: s.id,
            basePriceCents: sectionSpec.basePriceCents,
          })),
        );
      }
      venueSeats.set(venueSpec.name, seatList);
    }

    // Insert events.
    for (const eventSpec of EVENTS) {
      const [event] = await tx
        .insert(events)
        .values({
          venueId: venueIds.get(eventSpec.venue)!,
          name: eventSpec.name,
          description: eventSpec.description,
          startsAt: getStartDate(eventSpec.daysFromNow, eventSpec.hour),
          status: eventSpec.status,
        })
        .returning({ id: events.id });

      // Insert event seats.
      const seatInventory = venueSeats
        .get(eventSpec.venue)!
        .map(({ seatId, basePriceCents }) => ({
          eventId: event!.id,
          seatId,
          priceCents:
            Math.round((basePriceCents * eventSpec.priceMultiplier) / 100) *
            100,
          status: random() < eventSpec.soldRatio ? ('sold' as const) : ('available' as const),
        }));

      await tx.insert(eventSeats).values(seatInventory);
    }

    /* End Transaction */
  });

  // Log how many rows inserted
  const [counts] = await db
    .execute<{ venues: number; events: number; event_seats: number }>(
      sql`
  select
    (select count(*)::int from venues) as venues,
    (select count(*)::int from events) as events,
    (select count(*)::int from event_seats) as event_seats
`,
    )
    .then((r) => r.rows);
  console.log(
    `Seeded ${counts!.venues} venues, ${counts!.events} events, ${counts!.event_seats} event seats.`,
  );

  // Clear stale Redis cache values.
  const redis = new Redis(env.REDIS_URL, { maxRetriesPerRequest: 1, lazyConnect: true });
  try {
    await redis.connect();

    // Scan walks the keyspace in small batches. Avoid KEYS in real apps: it blocks Redis.
    const keys = ['cities'];
    for await (const batch of redis.scanStream({ match: 'event:*', count: 500 })) {
      keys.push(...(batch as string[]));
    }
    await redis.del(...keys);
    console.log(`Cleared the Redis cache (${keys.length} ${keys.length === 1 ? 'key' : 'keys'}).`);
  } catch(err) {
    console.error('Could not clear the Redis cache:', (err as Error).message);
  } finally {
    redis.disconnect();
  }
}

try {
  await seed();
} finally {
  await pool.end();
}
