import { Redis } from 'ioredis';
import { env } from './env.js';

export const redis = new Redis(env.REDIS_URL, {
  // Fail fast instead of queueing commands while Redis is unreachable.
  // Worth thinking about: what should the API do when its cache is down?
  maxRetriesPerRequest: 1,
  enableOfflineQueue: false,
});

redis.on('error', (err) => {
  console.warn(`[redis] ${err.message}`);
});
