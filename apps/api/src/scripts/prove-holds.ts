/**
 * Proves holdSeats can't give one seat to two people (BUILD_PLAN milestone 10, "Prove it").
 *
 *   pnpm prove:holds
 *
 * Fires 50 holdSeats calls for the same seat at the same moment, each as a different
 * person, then checks that exactly one got the seat. Then try the experiment: remove
 * `.for('update')` in src/db/holds.ts, run it again and watch several people "win" the
 * same seat. Put it back afterwards.
 *
 * Uses your development database: it creates 50 throwaway accounts (@race.invalid) and
 * deletes them at the end, which deletes their holds and frees the seat again.
 */
import { and, eq, inArray, like } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/node-postgres';
import pg from 'pg';
import { env } from '../env.js';
import { holdSeats, type HoldSeatsOutcome } from '../db/holds.js';
import * as schema from '../db/schema.js';
import { events, eventSeats, holds, users } from '../db/schema.js';
import { activeHold, isAvailableSql } from '../db/seatStatus.js';

const CONTENDERS = 50;
const EMAIL_DOMAIN = 'race.invalid';

// A pool of its own with a connection per contender. The app's pool has 10, which would
// queue 40 of the 50 calls; this way all 50 transactions really are in flight together.
const pool = new pg.Pool({ connectionString: env.DATABASE_URL, max: CONTENDERS });
const db = drizzle({ client: pool, schema });

async function main(): Promise<boolean> {
  // Any free seat in an event that's on sale.
  const [target] = await db
    .select({ seatId: eventSeats.id, eventId: eventSeats.eventId, eventName: events.name })
    .from(eventSeats)
    .innerJoin(events, eq(eventSeats.eventId, events.id))
    .leftJoin(holds, activeHold)
    .where(and(eq(events.status, 'on_sale'), isAvailableSql))
    .limit(1);
  if (!target) throw new Error('No free seat in an event that is on sale. Run `pnpm db:seed` first.');

  await removeContenders(); // in case an earlier run was interrupted
  const contenders = await db
    .insert(users)
    .values(
      Array.from({ length: CONTENDERS }, (_, i) => ({
        email: `contender-${i + 1}@${EMAIL_DOMAIN}`,
        passwordHash: 'not a real hash: these accounts never sign in',
      })),
    )
    .returning({ id: users.id });

  // Open every connection first, so the race isn't staggered by connection setup.
  const clients = await Promise.all(contenders.map(() => pool.connect()));
  clients.forEach((client) => client.release());

  console.log(`${CONTENDERS} people try to hold the same seat at "${target.eventName}"…`);
  const started = performance.now();
  const outcomes = await Promise.all(
    contenders.map(
      (person): Promise<HoldSeatsOutcome | { kind: 'error'; message: string }> =>
        holdSeats(db, { userId: person.id, eventId: target.eventId, seatIds: [target.seatId] }).catch(
          (error: unknown) => ({ kind: 'error', message: error instanceof Error ? error.message : String(error) }),
        ),
    ),
  );
  const elapsed = Math.round(performance.now() - started);

  const count = (kind: string) => outcomes.filter((outcome) => outcome.kind === kind).length;
  const held = count('held');
  const unavailable = count('unavailable');
  const errors = outcomes.filter((outcome) => outcome.kind === 'error');

  // Ask the database too: how many holds did the contenders end up with?
  const holdsCreated = await db
    .select({ id: holds.id })
    .from(holds)
    .where(inArray(holds.userId, contenders.map((person) => person.id)));

  console.log(`\nFinished in ${elapsed} ms`);
  console.log(`  Got the seat:      ${held}`);
  console.log(`  Told it was taken: ${unavailable}`);
  console.log(`  Errors:            ${errors.length}`);
  console.log(`  Holds in the database for those people: ${holdsCreated.length}`);
  for (const { message } of errors.slice(0, 3)) console.log(`    error: ${message}`);

  const passed = held === 1 && unavailable === CONTENDERS - 1 && errors.length === 0 && holdsCreated.length === 1;
  console.log(
    passed
      ? '\nPASS: exactly one person got the seat.'
      : `\nFAIL: ${held} people were told they got the same seat. Is \`.for('update')\` missing in src/db/holds.ts?`,
  );
  return passed;
}

/** Deletes the throwaway accounts. Their holds go with them, which frees the seat. */
async function removeContenders() {
  await db.delete(users).where(like(users.email, `%@${EMAIL_DOMAIN}`));
}

let passed = false;
try {
  passed = await main();
} catch (error) {
  console.error(error);
} finally {
  await removeContenders();
  await pool.end();
}
process.exit(passed ? 0 : 1);
