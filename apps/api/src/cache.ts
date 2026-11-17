import type { Redis } from 'ioredis';

interface CacheAsideOptions<V> {
  /** The Redis key for one id, e.g. (id) => `event:${id}:availability`. */
  key: (id: string) => string;
  /** How long a cached value lives. Also the most out of date a value can be. */
  ttlSeconds: number;
  /** Loads the ids that weren't cached. Must return one value per id, in the same order. */
  fetch: (missIds: readonly string[]) => Promise<V[]>;
}

/**
 * Cache-aside for a batch of ids, in at most two Redis round trips:
 *   1. MGET every key.
 *   2. Anything missing (or unreadable) is a miss.
 *   3. Load only the misses from the source of truth (`fetch`).
 *   4. Write the misses back with a TTL, in one pipeline.
 *   5. Return values in the same order as `ids`, so it can back a DataLoader directly.
 *
 * Redis only ever makes this faster, never broken: if a read fails, everything counts as a
 * miss; if a write fails, it's skipped. Either way the caller still gets correct data.
 */
export async function cacheAside<V>(
  redis: Redis,
  ids: readonly string[],
  { key, ttlSeconds, fetch }: CacheAsideOptions<V>,
): Promise<V[]> {
  if (ids.length === 0) return [];
  const keys = ids.map(key);
  const results = new Array<V>(ids.length);

  // 1. One round trip for every key. Null means a miss.
  let cached: (string | null)[];
  try {
    cached = await redis.mget(...keys);
  } catch (err) {
    console.warn(`[cache] read failed, using the database: ${(err as Error).message}`);
    cached = keys.map(() => null);
  }

  // 2. Hits go straight into the results; misses are remembered by position.
  const missIndexes: number[] = [];
  cached.forEach((value, i) => {
    if (value !== null) {
      try {
        results[i] = JSON.parse(value) as V;
        return;
      } catch {
        // Not valid JSON (e.g. left over from an older format): treat it as a miss.
      }
    }
    missIndexes.push(i);
  });
  if (missIndexes.length === 0) return results;

  // 3. Only the misses touch the database.
  const missIds = missIndexes.map((i) => ids[i]!);
  const fresh = await fetch(missIds);
  missIndexes.forEach((resultIndex, j) => {
    results[resultIndex] = fresh[j]!;
  });

  // 4. Write back in one round trip. MSET can't set an expiry, so it's one SET ... EX per
  //    key in a pipeline. Not a transaction (MULTI): each key stands alone, so none is needed.
  try {
    const pipeline = redis.pipeline();
    missIndexes.forEach((resultIndex, j) => {
      pipeline.set(keys[resultIndex]!, JSON.stringify(fresh[j]), 'EX', ttlSeconds);
    });
    // exec() reports a failed command as [error, null] instead of rejecting.
    const failed = (await pipeline.exec())?.find(([err]) => err);
    if (failed) throw failed[0];
  } catch (err) {
    console.warn(`[cache] write failed, skipping: ${(err as Error).message}`);
  }

  return results;
}
