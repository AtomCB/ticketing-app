import { db, type DB } from '../db/client.js';
import { createLoaders, type Loaders } from './loaders.js';

export type GraphQLContext = {
  db: DB;
  loaders: Loaders;
};

// Called once per HTTP request. Auth (the current user) will be added here in a later phase.
export function createContext(): GraphQLContext {
  return { db, loaders: createLoaders(db) };
}
