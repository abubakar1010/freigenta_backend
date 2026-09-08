import { redis } from "../database/redis";
import { AppError } from "./AppError";
import { logger } from "./logger";

/**
 * Distributed idempotency guard backed by Redis.
 *
 * Design contract (mirrors Section 31 of the product spec):
 *
 * 1. Before calling any external provider API, acquire a lock keyed on the
 *    idempotency key (e.g., `bridge-payout:{transactionId}:v1`).
 * 2. The lock TTL defaults to 24 hours — matching the provider's own
 *    idempotency window so duplicate calls are always rejected.
 * 3. If the lock is already held, the operation throws 409. The caller
 *    should NOT generate a new key — it must reuse the original and let the
 *    provider's own idempotency de-duplicate it.
 * 4. Locks are only released (deleted) for pure application validation
 *    failures where we know the provider was NEVER reached. For any
 *    network-level or timeout error, the lock stays in place.
 */
export class IdempotencyUtil {
  /**
   * Acquires an atomic Redis lock for the given idempotency key.
   * Uses SET NX EX — atomically sets only if key does not exist.
   * Returns true on success, throws AppError(409) if already locked.
   */
  static async acquireLock(
    idempotencyKey: string,
    ttlSeconds: number = 86_400 // 24 hours
  ): Promise<boolean> {
    const lockKey = `lock:idempotency:${idempotencyKey}`;
    const result = await redis.set(lockKey, "locked", "EX", ttlSeconds, "NX");

    if (result !== "OK") {
      logger.warn(
        { idempotencyKey },
        "[Idempotency] Duplicate operation rejected"
      );
      throw new AppError(
        `Operation '${idempotencyKey}' is already in progress or has been completed.`,
        409
      );
    }

    logger.debug({ idempotencyKey }, "[Idempotency] Lock acquired");
    return true;
  }

  /**
   * Releases the Redis lock — call ONLY when you are certain the provider
   * was never reached (e.g., a validation error before the HTTP call).
   */
  static async releaseLock(idempotencyKey: string): Promise<void> {
    const lockKey = `lock:idempotency:${idempotencyKey}`;
    await redis.del(lockKey);
    logger.debug({ idempotencyKey }, "[Idempotency] Lock released");
  }

  /**
   * Wraps an async operation in idempotency protection.
   *
   * The lock is released only for client-side validation errors (4xx < 500).
   * For all other errors — including network timeouts — the lock persists.
   * This prevents the "phantom delivery" problem where the provider received
   * the request but we timed out reading the response.
   */
  static async executeIdempotent<T>(
    idempotencyKey: string,
    operation: () => Promise<T>,
    ttlSeconds?: number
  ): Promise<T> {
    await this.acquireLock(idempotencyKey, ttlSeconds);
    try {
      return await operation();
    } catch (error) {
      if (error instanceof AppError && error.statusCode < 500) {
        // Pure validation failure — provider was never contacted
        await this.releaseLock(idempotencyKey);
      }
      throw error;
    }
  }
}
