import { drizzle } from 'drizzle-orm/node-postgres';
import pg from 'pg';
import { env } from '../env.js';
import * as schema from './schema.js';

export const pool = new pg.Pool({ connectionString: env.DATABASE_URL, max: 10 });

// Log every SQL statement in development. Reading the SQL your ORM generates is
// the fastest way to learn Postgres; turn it off if it gets noisy.
export const db = drizzle({
  client: pool,
  schema,
  logger: process.env.NODE_ENV !== 'production' && process.env.LOG_SQL !== 'false',
});

export type DB = typeof db;
