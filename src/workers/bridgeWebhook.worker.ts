import { Job } from "bullmq";
import { PaymentOrder } from "../shared/models/paymentOrder.model";
import { ProviderTransaction } from "../shared/models/providerTransaction.model";
import { Invoice } from "../shared/models/invoice.model";
import { ledgerService } from "../shared/services/ledger.service";
import { logAudit } from "../shared/utils/audit";
import { logger } from "../shared/utils/logger";

/**
 * Bridge.xyz webhook event processor.
 *
 * Bridge emits transfer state changes asynchronously. This worker consumes
 * those events and advances the PaymentOrder state machine accordingly.
 *
 * Events handled:
 *   transfer.completed  → CARRIER_PAID / COMPLETED
 *   transfer.failed     → FAILED (with audit log)
 *   liquidation_address.funds_received → BRIDGE_FUNDS_RECEIVED
 */
export const processBridgeWebhook = async (job: Job): Promise<void> => {
  const payload = job.data;
  const eventType: string = payload.event || payload.type || "";
  const data = payload.data || payload;
  const SYSTEM_ACTOR = "000000000000000000000000";

  logger.info(
    { jobId: job.id, eventType, bridgeId: data.id },
    "[BridgeWorker] Processing event"
  );

  // ── transfer.completed ──────────────────────────────────────────────────────
  if (eventType === "transfer.completed") {
    const settlementId: string = data.id;
    if (!settlementId) {
      logger.warn({ payload }, "[BridgeWorker] transfer.completed missing id");
      return;
    }

    const tx = await ProviderTransaction.findOne({
      providerTransactionId: settlementId,
      provider: "bridge",
    });

    if (!tx) {
      logger.warn(
        { settlementId },
        "[BridgeWorker] ProviderTransaction not found for transfer"
      );
      return;
    }

    if (tx.status === "completed") {
      logger.info(
        { settlementId },
        "[BridgeWorker] Already marked completed — idempotent skip"
      );
      return;
    }

    tx.status = "completed";
    tx.rawResponse = { ...tx.rawResponse, completedAt: new Date() };
    await tx.save();

    const paymentOrder = await PaymentOrder.findById(tx.paymentOrderId);
    if (!paymentOrder) {
      logger.warn({ paymentOrderId: tx.paymentOrderId }, "[BridgeWorker] PaymentOrder not found");
      return;
    }

    const prev = paymentOrder.status;
    paymentOrder.status = "COMPLETED";
    await paymentOrder.save();

    // Mark invoice completed
    await Invoice.findByIdAndUpdate(paymentOrder.invoiceId, { status: "COMPLETED" });

    // Post the settlement ledger entry
    await ledgerService.postDoubleEntry(
      paymentOrder._id.toString(),
      paymentOrder.customerId.toString(),
      "bridge",
      settlementId,
      paymentOrder.invoiceCurrency,
      paymentOrder.beneficiaryAmount,
      "BRIDGE_WALLET",
      "CARRIER_ACCOUNT"
    );

    await logAudit(
      SYSTEM_ACTOR,
      "BRIDGE_TRANSFER_COMPLETED",
      paymentOrder._id.toString(),
      { status: prev },
      { status: "COMPLETED", settlementId }
    );

    logger.info(
      { paymentOrderId: paymentOrder._id.toString(), settlementId },
      "[BridgeWorker] PaymentOrder marked COMPLETED"
    );
    return;
  }

  // ── transfer.failed ─────────────────────────────────────────────────────────
  if (eventType === "transfer.failed") {
    const settlementId: string = data.id;
    const tx = await ProviderTransaction.findOne({
      providerTransactionId: settlementId,
      provider: "bridge",
    });

    if (tx) {
      tx.status = "failed";
      tx.rawResponse = { ...tx.rawResponse, failedAt: new Date(), reason: data.failure_reason };
      await tx.save();

      const paymentOrder = await PaymentOrder.findById(tx.paymentOrderId);
      if (paymentOrder) {
        const prev = paymentOrder.status;
        paymentOrder.status = "FAILED";
        await paymentOrder.save();

        await logAudit(
          SYSTEM_ACTOR,
          "BRIDGE_TRANSFER_FAILED",
          paymentOrder._id.toString(),
          { status: prev },
          { status: "FAILED", settlementId, reason: data.failure_reason }
        );
      }
    }

    logger.error(
      { settlementId, reason: data.failure_reason },
      "[BridgeWorker] Transfer failed — manual intervention may be required"
    );
    return;
  }

  // ── liquidation_address.funds_received ──────────────────────────────────────
  if (eventType === "liquidation_address.funds_received") {
    // Bridge has received our USDC from Esca. Advance the PaymentOrder
    // so it is ready for admin-triggered payout.
    const bridgeCustomerId: string = data.customer_id;
    if (!bridgeCustomerId) return;

    const paymentOrder = await PaymentOrder.findOne({
      bridgeCustomerId,
      status: "BRIDGE_FUNDING_PENDING",
    });

    if (!paymentOrder) {
      logger.warn(
        { bridgeCustomerId },
        "[BridgeWorker] No matching PaymentOrder in BRIDGE_FUNDING_PENDING"
      );
      return;
    }

    paymentOrder.status = "BRIDGE_FUNDS_RECEIVED";
    await paymentOrder.save();

    await logAudit(
      SYSTEM_ACTOR,
      "BRIDGE_FUNDS_RECEIVED",
      paymentOrder._id.toString(),
      { status: "BRIDGE_FUNDING_PENDING" },
      { status: "BRIDGE_FUNDS_RECEIVED" }
    );

    logger.info(
      { paymentOrderId: paymentOrder._id.toString() },
      "[BridgeWorker] Bridge funds received — awaiting admin payout approval"
    );
    return;
  }

  logger.info(
    { eventType },
    "[BridgeWorker] Unhandled event type — no action taken"
  );
};
