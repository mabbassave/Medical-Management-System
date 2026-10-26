import Redis from 'ioredis';
import { env } from './env';

export const redisClient = new Redis(env.REDIS_URL, {
  maxRetriesPerRequest: 3,
  retryStrategy(times) {
    // Retry with incremental backoff, capping at 3 seconds
    const delay = Math.min(times * 200, 3000);
    if (times > 10) {
      console.warn('⚠️ [Redis] Retry limit reached. Operations will fail gracefully without crashing.');
      return null; // Stop retrying after 10 attempts
    }
    return delay;
  },
  reconnectOnError(err) {
    const targetError = 'READONLY';
    if (err.message.includes(targetError)) {
      return true;
    }
    return false;
  },
  enableOfflineQueue: true,
});

redisClient.on('connect', () => {
  console.log('Redis connected successfully');
});

redisClient.on('ready', () => {
  console.log('Redis client is ready');
});

redisClient.on('error', (err) => {
  console.warn('[Redis] Client error', { errorName: err.name });
});

/**
 * Explicitly ping Redis at startup to surface connection failures early.
 * Uses a non-fatal approach: a failure is logged as a warning, not a thrown
 * error, so the server can still start and serve requests that don't need Redis.
 */
export const connectRedis = async (): Promise<void> => {
  try {
    await redisClient.ping();
    console.log('✅ [Redis] Connection verified via PING.');
  } catch (err: any) {
    console.warn(
      '[Redis] Could not reach Redis at startup.',
      { errorName: err instanceof Error ? err.name : 'UnknownError' },
      '\n   Token blacklisting and caching will be degraded until Redis is available.',
    );
  }
};
