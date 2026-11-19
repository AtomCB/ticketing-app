import dotenv from 'dotenv';

dotenv.config({ quiet: true });

// Defaults match docker-compose.yml, so the app runs without a .env file.
export const env = {
  DATABASE_URL:
    process.env.DATABASE_URL ?? 'postgres://ticketing:ticketing@localhost:5432/ticketing',
  REDIS_URL: process.env.REDIS_URL ?? 'redis://localhost:6379',
  PORT: Number(process.env.PORT ?? 4000),
  WEB_ORIGIN: process.env.WEB_ORIGIN ?? 'http://localhost:5173',
  /** Read once here: a typo in `env.IS_PRODUCTION` is a type error; one in process.env isn't. */
  IS_PRODUCTION: process.env.NODE_ENV === 'production',
};
