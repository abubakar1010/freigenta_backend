import { Queue, Worker, Job } from "bullmq";
import { createBullMQConnection } from "../database/redis";
import { logger } from "../utils/logger";

/**
 * Centralized BullMQ queue/worker registry.
 *
 * Architecture decisions:
 * - Each Queue and Worker gets its own dedicated ioredis connection because
 *   BullMQ mandates `maxRetriesPerRequest: null` which is incompatible with
 *   a shared connection used by other consumers.
 * - We use `removeOnComplete: true` to avoid unbounded queue growth in Redis.
 * - Failed jobs are kept (removeOnFail: false) and effectively become a
 *   dead-letter queue viewable via BullMQ Board.
 * - `jobId` on `addJob` provides BullMQ-level idempotency — adding a job
 *   with an existing ID is a no-op.
 */
export class QueueService {
  private queues: Map<string, Queue> = new Map();
  private workers: Map<string, Worker> = new Map();

  /**
   * Registers a named queue with its processor function.
   * Idempotent — calling twice with the same name is a no-op.
   */
  public registerQueue(
    queueName: string,
    processor: (job: Job) => Promise<any>,
    concurrency: number = 5
  ): void {
    if (this.queues.has(queueName)) {
      logger.warn(
        { queueName },
        "[QueueService] Queue already registered — skipping"
      );
      return;
    }

    const queue = new Queue(queueName, {
      connection: createBullMQConnection(),
      defaultJobOptions: {
        attempts: 5,
        backoff: { type: "exponential", delay: 1_000 },
        removeOnComplete: true,
        removeOnFail: false, // Retain for DLQ inspection
      },
    });

    const worker = new Worker(queueName, processor, {
      connection: createBullMQConnection(),
      concurrency,
    });

    worker.on("failed", (job, err) => {
      logger.error(
        { jobId: job?.id, queueName, err: err.message, attempts: job?.attemptsMade },
        "[QueueService] Job failed"
      );
    });

    worker.on("completed", (job) => {
      logger.info(
        { jobId: job?.id, queueName },
        "[QueueService] Job completed"
      );
    });

    worker.on("error", (err) => {
      logger.error({ queueName, err }, "[QueueService] Worker error");
    });

    this.queues.set(queueName, queue);
    this.workers.set(queueName, worker);

    logger.info({ queueName }, "[QueueService] Queue registered");
  }

  /**
   * Enqueues a job.
   * Passing `jobId` makes the operation idempotent — BullMQ will silently
   * ignore duplicate IDs.
   */
  public async addJob(
    queueName: string,
    jobName: string,
    data: any,
    jobId?: string
  ): Promise<void> {
    const queue = this.queues.get(queueName);
    if (!queue) {
      throw new Error(
        `[QueueService] Queue '${queueName}' is not registered. ` +
          "Call registerQueue() before addJob()."
      );
    }

    await queue.add(jobName, data, { jobId });
    logger.debug({ queueName, jobName, jobId }, "[QueueService] Job enqueued");
  }

  /** Gracefully drains all workers before process shutdown. */
  public async shutdown(): Promise<void> {
    logger.info("[QueueService] Graceful shutdown initiated");
    for (const [name, worker] of this.workers.entries()) {
      await worker.close();
      logger.info({ queueName: name }, "[QueueService] Worker closed");
    }
    for (const [name, queue] of this.queues.entries()) {
      await queue.close();
      logger.info({ queueName: name }, "[QueueService] Queue connection closed");
    }
  }
}

// Singleton — every module imports this instance
export const queueService = new QueueService();
