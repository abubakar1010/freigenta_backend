import { Job } from "bullmq";
import { PaymentOrder } from "../shared/models/paymentOrder.model";
import { ProviderTransaction } from "../shared/models/providerTransaction.model";
import { ledgerService } from "../shared/services/ledger.service";
import { queueService } from "../shared/services/queue.service";
import { logAudit } from "../shared/utils/audit";
import { logger } from "../shared/utils/logger";

/**
 * Esca Finance webhook event processor.
 *
 * Esca emits payment events when funds arrive in the virtual account.
 * This worker handles the full reconciliation logic:
 *  1. Locate the PaymentOrder by payment reference
 *  2. Handle exact / underpaid / overpaid scenarios
 *  3. Post the ledger entry on exact/overpaid payments
 *  4. Advance the settlement pipeline
 */
export const processEscaWebhook = async (job: Job): Promise<void> => {
  const payload = job.data;
  const eventType: string = payload.event || payload.type || "";
  const data = payload.data || payload;
  const SYSTEM_ACTOR = "000000000000000000000000";

  logger.info(
    { jobId: job.id, eventType, reference: data.reference },
    "[EscaWorker] Processing event"
  );

  // ── payment.successful ──────────────────────────────────────────────────────
  if (eventType === "payment.successful" || eventType === "payment.received") {
    const transactionReference: string = data.reference || data.payment_reference;
    if (!transactionReference) {
      logger.warn({ payload }, "[EscaWorker] Missing transaction reference");
      return;
    }

    const paymentOrder = await PaymentOrder.findOne({ transactionReference });
    if (!paymentOrder) {
      logger.warn(
        { transactionReference },
        "[EscaWorker] PaymentOrder not found for reference"
      );
      return;
    }

    // Idempotency guard: skip if already advanced past AWAITING_PAYMENT
    if (paymentOrder.status !== "AWAITING_PAYMENT") {
      logger.info(
        { paymentOrderId: paymentOrder._id.toString(), status: paymentOrder.status },
        "[EscaWorker] Already processed — idempotent skip"
      );
      return;
    }

    const receivedAmount = parseFloat(String(data.amount));
    const expectedAmount = paymentOrder.expectedCollectionAmount;
    const currency: string = data.currency || "NGN";

    const providerTransactionId = String(data.id || data.transaction_id || `esca_${Date.now()}`);
    const idempotencyKey = `esca-collection:${paymentOrder._id.toString()}:${providerTransactionId}`;

    // Store raw provider transaction record before mutating state
    await ProviderTransaction.create({
      paymentOrderId: paymentOrder._id,
      provider: "esca",
      providerTransactionType: "collection",
      providerTransactionId,
      idempotencyKey,
      currency,
      amount: receivedAmount,
      status: "successful",
      rawResponse: payload,
    });

    paymentOrder.receivedCollectionAmount = receivedAmount;

    const TOLERANCE = 0.01; // 1 kobo / 1 cent tolerance for floating point

    if (receivedAmount < expectedAmount - TOLERANCE) {
      // Under-payment: flag for ops review
      paymentOrder.status = "PAYMENT_UNDERPAID";
      logger.warn(
        {
          paymentOrderId: paymentOrder._id.toString(),
          received: receivedAmount,
          expected: expectedAmount,
        },
        "[EscaWorker] Payment underpaid — flagged for ops review"
      );
    } else if (receivedAmount > expectedAmount + TOLERANCE) {
      // Over-payment: flag for ops review before proceeding
      paymentOrder.status = "PAYMENT_OVERPAID";
      logger.warn(
        {
          paymentOrderId: paymentOrder._id.toString(),
          received: receivedAmount,
          expected: expectedAmount,
        },
        "[EscaWorker] Payment overpaid — flagged for ops review"
      );
    } else {
      // Exact payment: advance the pipeline
      paymentOrder.status = "PAYMENT_RECEIVED";

      // Double-entry: debit ESCA_VIRTUAL_ACCOUNT, credit CUSTOMER_ESCROW
      await ledgerService.postDoubleEntry(
        paymentOrder._id.toString(),
        paymentOrder.customerId.toString(),
        "esca",
        providerTransactionId,
        currency,
        receivedAmount,
        "ESCA_VIRTUAL_ACCOUNT",
        "CUSTOMER_ESCROW"
      );

      paymentOrder.status = "PAID_PENDING_VERIFICATION";

      await queueService.addJob(
        "process-settlement",
        "check_verification",
        { paymentOrderId: paymentOrder._id.toString() },
        `check-verification:${paymentOrder._id.toString()}`
      );

      logger.info(
        { paymentOrderId: paymentOrder._id.toString(), receivedAmount },
        "[EscaWorker] Payment received — advanced to verification"
      );
    }

    await paymentOrder.save();

    await logAudit(
      SYSTEM_ACTOR,
      "ESCA_PAYMENT_RECEIVED",
      paymentOrder._id.toString(),
      { status: "AWAITING_PAYMENT" },
      { status: paymentOrder.status, receivedAmount, expectedAmount }
    );
    return;
  }

  logger.info(
    { eventType },
    "[EscaWorker] Unhandled event type — no action taken"
  );
};
