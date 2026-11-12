import { db, type DB } from '../db/client.js';
import { redis } from '../redis.js';
import { createLoaders, type Loaders } from './loaders.js';

export type GraphQLContext = {
  db: DB;
  redis: typeof redis;
  loaders: Loaders;
};

// Called once per request. Per-request things belong here: DataLoaders (milestone 6)
// and the signed-in user (milestone 9).
export function createContext(): GraphQLContext {
  return { db, redis, loaders: createLoaders(db) };
}
