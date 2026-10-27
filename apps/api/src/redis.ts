import { Redis } from 'ioredis';
import { env } from './env.js';

export const redis = new Redis(env.REDIS_URL, {
  // Fail fast instead of queueing commands while Redis is unreachable. Redis is a
  // cache here, so the API should fall back to Postgres rather than hang.
  maxRetriesPerRequest: 1,
  enableOfflineQueue: false,
});

redis.on('error', (err) => {
  console.warn(`[redis] ${err.message}`);
});

/**
 * Cache-aside for a single key: return the cached JSON if present, otherwise compute,
 * store with a TTL and return. Redis errors are logged and treated as a cache miss.
 */
export async function cached<T>(key: string, ttlSeconds: number, compute: () => Promise<T>): Promise<T> {
  try {
    const hit = await redis.get(key);
    if (hit !== null) return JSON.parse(hit) as T;
  } catch (err) {
    console.warn(`[redis] read failed for ${key}:`, (err as Error).message);
  }

  const value = await compute();

  try {
    await redis.set(key, JSON.stringify(value), 'EX', ttlSeconds);
  } catch (err) {
    console.warn(`[redis] write failed for ${key}:`, (err as Error).message);
  }
  return value;
}
