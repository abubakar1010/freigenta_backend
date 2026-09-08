import { Job } from "bullmq";
import { PaymentOrder } from "../shared/models/paymentOrder.model";
import { User } from "../shared/models/user.model";
import { EscaClient } from "../integrations/esca/esca.client";
import { queueService } from "../shared/services/queue.service";
import { logAudit } from "../shared/utils/audit";
import { AppError } from "../shared/utils/AppError";
import { logger } from "../shared/utils/logger";

/**
 * Settlement queue worker.
 *
 * Each job name corresponds to a discrete step in the settlement pipeline.
 * State guard checks at the top of each branch prevent a job from running
 * if the PaymentOrder has already advanced past the expected state — this
 * makes every step idempotent and safe to replay after a worker crash.
 *
 * Pipeline (happy path):
 *   check_verification
 *     → [admin approves] → execute-esca-conversion
 *     → send-esca-funds-to-bridge
 *     → [Bridge webhook] → initiate-bridge-payout
 *     → [Bridge webhook] → COMPLETED
 */
export const processSettlementQueue = async (job: Job): Promise<void> => {
  const { paymentOrderId } = job.data;
  const SYSTEM_ACTOR = "00000000000000000000000"; // Sentinel for system-initiated audit events

  // ── Load payment order ──────────────────────────────────────────────────────
  const paymentOrder = await PaymentOrder.findById(paymentOrderId);
  if (!paymentOrder) {
    // Non-retryable: if the record is gone, retrying will never succeed
    throw new AppError(`PaymentOrder not found: ${paymentOrderId}`, 404);
  }

  // ── Step: check_verification ────────────────────────────────────────────────
  if (job.name === "check_verification") {
    logger.info(
      { paymentOrderId, jobId: job.id },
      "[SettlementWorker] Running check_verification"
    );

    const user = await User.findById(paymentOrder.customerId);
    if (!user) throw new AppError("Customer not found for PaymentOrder", 404);

    const prev = paymentOrder.status;

    if (user.identityVerificationStatus === "VERIFIED") {
      paymentOrder.status = "VERIFIED_PENDING_SETTLEMENT";
    } else {
      // Keep in UNDER_VERIFICATION — admin or YouVerify webhook will advance it
      paymentOrder.status = "UNDER_VERIFICATION";
    }

    await paymentOrder.save();

    await logAudit(
      user._id.toString(),
      "SETTLEMENT_VERIFICATION_CHECKED",
      paymentOrderId,
      { status: prev },
      { status: paymentOrder.status, identityVerificationStatus: user.identityVerificationStatus }
    );
    return;
  }

  // ── Step: execute-esca-conversion ───────────────────────────────────────────
  if (job.name === "execute-esca-conversion") {
    const VALID_STATES = ["VERIFIED_PENDING_SETTLEMENT", "ESCA_CONVERSION_PENDING"];
    if (!VALID_STATES.includes(paymentOrder.status)) {
      logger.warn(
        { paymentOrderId, status: paymentOrder.status },
        "[SettlementWorker] execute-esca-conversion: unexpected state — skipping"
      );
      return;
    }

    logger.info({ paymentOrderId, jobId: job.id }, "[SettlementWorker] Starting ESCA FX conversion");

    paymentOrder.status = "ESCA_CONVERSION_PROCESSING";
    await paymentOrder.save();

    try {
      const escaClient = new EscaClient();

      // 1. Request an FX quote from Esca for the exact received NGN amount
      const fxQuote = await escaClient.requestFxQuote(
        paymentOrder.collectionCurrency, // NGN
        paymentOrder.invoiceCurrency,    // USD
        paymentOrder.receivedCollectionAmount
      );

      if (!fxQuote?.id) {
        throw new AppError("Esca FX quote response missing quote ID", 502);
      }

      // 2. Execute the conversion against the live quote using the
      //    PaymentOrder ID as idempotency key — safe to replay
      const escaNgnAccountId = process.env.ESCA_NGN_ACCOUNT_ID;
      if (!escaNgnAccountId) {
        throw new AppError("ESCA_NGN_ACCOUNT_ID environment variable is not set", 500);
      }

      const idempotencyKey = `esca-conversion:${paymentOrderId}:v1`;
      const conversion = await escaClient.executeConversion(
        fxQuote.id,
        escaNgnAccountId,
        idempotencyKey
      );

      if (!conversion?.id) {
        throw new AppError("Esca conversion response missing conversion ID", 502);
      }

      paymentOrder.status = "ESCA_CONVERSION_COMPLETED";
      await paymentOrder.save();

      logger.info(
        { paymentOrderId, conversionId: conversion.id },
        "[SettlementWorker] ESCA conversion completed"
      );

      await logAudit(
        SYSTEM_ACTOR,
        "ESCA_CONVERSION_EXECUTED",
        paymentOrderId,
        { status: "ESCA_CONVERSION_PROCESSING" },
        { status: "ESCA_CONVERSION_COMPLETED", conversionId: conversion.id }
      );

      // Automatically advance to the next step
      await queueService.addJob(
        "process-settlement",
        "send-esca-funds-to-bridge",
        { paymentOrderId },
        `settlement-bridge-transfer:${paymentOrderId}`
      );
    } catch (error) {
      logger.error(
        { paymentOrderId, err: (error as Error).message },
        "[SettlementWorker] ESCA conversion failed"
      );
      // BullMQ will retry with exponential backoff up to 5 attempts.
      // On final failure, the job lands in the dead-letter set.
      throw error;
    }
    return;
  }

  // ── Step: send-esca-funds-to-bridge ─────────────────────────────────────────
  if (job.name === "send-esca-funds-to-bridge") {
    if (paymentOrder.status !== "ESCA_CONVERSION_COMPLETED") {
      logger.warn(
        { paymentOrderId, status: paymentOrder.status },
        "[SettlementWorker] send-esca-funds-to-bridge: unexpected state — skipping"
      );
      return;
    }

    logger.info(
      { paymentOrderId, jobId: job.id },
      "[SettlementWorker] Sending USDC from Esca to Bridge"
    );

    paymentOrder.status = "ESCA_TRANSFER_TO_BRIDGE_SUBMITTED";
    await paymentOrder.save();

    try {
      const escaClient = new EscaClient();
      const bridgeDepositAddress = process.env.BRIDGE_USDC_DEPOSIT_ADDRESS;

      if (!bridgeDepositAddress) {
        throw new AppError("BRIDGE_USDC_DEPOSIT_ADDRESS environment variable is not set", 500);
      }

      const idempotencyKey = `esca-to-bridge:${paymentOrderId}:v1`;
      const payout = await escaClient.sendStablecoin(
        paymentOrder.beneficiaryAmount,
        bridgeDepositAddress,
        idempotencyKey
      );

      if (!payout?.id) {
        throw new AppError("Esca stablecoin payout response missing ID", 502);
      }

      paymentOrder.status = "BRIDGE_FUNDING_PENDING";
      await paymentOrder.save();

      logger.info(
        { paymentOrderId, payoutId: payout.id },
        "[SettlementWorker] ESCA→Bridge transfer submitted, awaiting Bridge funding confirmation"
      );

      await logAudit(
        SYSTEM_ACTOR,
        "ESCA_TO_BRIDGE_TRANSFER_SUBMITTED",
        paymentOrderId,
        { status: "ESCA_TRANSFER_TO_BRIDGE_SUBMITTED" },
        { status: "BRIDGE_FUNDING_PENDING", payoutId: payout.id }
      );
    } catch (error) {
      logger.error(
        { paymentOrderId, err: (error as Error).message },
        "[SettlementWorker] ESCA→Bridge transfer failed"
      );
      throw error;
    }
    return;
  }

  // ── Step: initiate-bridge-payout ────────────────────────────────────────────
  // This step is triggered by the Bridge webhook worker once Bridge confirms
  // funds received. The actual payout call is in settlement.service.ts
  // (approveSettlement). This job is a no-op hook for future automation.
  if (job.name === "initiate-bridge-payout") {
    logger.info(
      { paymentOrderId, status: paymentOrder.status },
      "[SettlementWorker] Bridge payout trigger received — awaiting admin approval"
    );
    return;
  }

  logger.warn(
    { jobName: job.name, paymentOrderId },
    "[SettlementWorker] Unknown job name — no handler registered"
  );
};
