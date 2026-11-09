import { sql } from 'drizzle-orm';
import { db } from './db/client.js';
import { redis } from './redis.js';

export type HealthStatus = { postgres: boolean; redis: boolean };

export async function checkHealth(): Promise<HealthStatus> {
  const [postgres, cache] = await Promise.allSettled([db.execute(sql`select 1`), redis.ping()]);
  return { postgres: postgres.status === 'fulfilled', redis: cache.status === 'fulfilled' };
}
