import Redis from 'ioredis';
import { logger } from '../utils/logger';

/**
 * Centralized Redis connection factory.
 *
 * A single shared connection is used for general-purpose operations
 * (idempotency, caching, etc.). BullMQ requires dedicated connections
 * with maxRetriesPerRequest: null, so we expose a factory for those.
 */

const BASE_OPTIONS = {
  host: process.env.REDIS_HOST || '127.0.0.1',
  port: parseInt(process.env.REDIS_PORT || '6379', 10),
  password: process.env.REDIS_PASSWORD || undefined,
  // Exponential backoff, capped at 30 s
  retryStrategy: (times: number) => Math.min(times * 200, 30_000),
};

/** Shared general-purpose connection (idempotency, caching, etc.) */
const sharedConnection = new Redis(BASE_OPTIONS);

sharedConnection.on('connect', () =>
  logger.info('[Redis] Shared connection established'),
);
sharedConnection.on('error', (err) =>
  logger.error({ err }, '[Redis] Shared connection error'),
);

/**
 * Creates a **dedicated** ioredis connection for BullMQ Queues/Workers.
 * BullMQ mandates maxRetriesPerRequest: null on its connections.
 */
export function createBullMQConnection(): Redis {
  const conn = new Redis({ ...BASE_OPTIONS, maxRetriesPerRequest: null });
  conn.on('error', (err) =>
    logger.warn({ err }, '[Redis] BullMQ connection error'),
  );
  return conn;
}

export { sharedConnection as redis };
