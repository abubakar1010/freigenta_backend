import { queueService } from "../shared/services/queue.service";
import { processEscaWebhook } from "./escaWebhook.worker";
import { processBridgeWebhook } from "./bridgeWebhook.worker";
import { processSettlementQueue } from "./settlement.worker";
import { processYouVerifyWebhook } from "./youverifyWebhook.worker";
import { logger } from "../shared/utils/logger";

/**
 * Registers all BullMQ workers with the queue service.
 * Called once at server startup (app.ts) after the Redis connection is live.
 *
 * Each queue name here MUST match the queue name used in the corresponding
 * queueService.addJob() call — they are the coordination contract.
 */
export const registerAllWorkers = (): void => {
  // Payment collection events from Esca Finance
  queueService.registerQueue("process-esca-webhook", processEscaWebhook);

  // Payout and funding events from Bridge.xyz
  queueService.registerQueue("process-bridge-webhook", processBridgeWebhook);

  // Internal settlement pipeline state machine
  queueService.registerQueue("process-settlement", processSettlementQueue, 3);

  // KYC status updates from YouVerify (was previously a no-op)
  queueService.registerQueue("process-youverify-webhook", processYouVerifyWebhook);

  // FindTEU shipment tracking events (placeholder for full implementation)
  queueService.registerQueue("process-findteu-webhook", async (job) => {
    logger.info(
      { jobId: job.id, event: job.data?.event },
      "[FindTEUWorker] Received event — full handler TBD"
    );
  });

  logger.info("[Workers] All background workers registered successfully");
};
