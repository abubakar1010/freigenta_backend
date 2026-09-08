import { Job } from "bullmq";
import { User } from "../shared/models/user.model";
import { PaymentOrder } from "../shared/models/paymentOrder.model";
import { queueService } from "../shared/services/queue.service";
import { logAudit } from "../shared/utils/audit";
import { logger } from "../shared/utils/logger";

/**
 * YouVerify webhook event processor.
 *
 * YouVerify emits identity verification results asynchronously. This worker
 * consumes those events from the queue and updates the user's
 * identityVerificationStatus, then advances any PaymentOrders that are
 * blocked on verification.
 *
 * Event shapes we handle:
 *  - identity.verification.completed  → status: "found" | "not_found"
 *  - identity.verification.failed     → terminal failure
 *  - identity.verification.manual_review → requires human review
 */
export const processYouVerifyWebhook = async (job: Job): Promise<void> => {
  const payload = job.data;
  const eventType: string = payload.event || payload.type || "";
  const data = payload.data || payload;

  logger.info(
    { jobId: job.id, eventType, reference: data.id || data.reference },
    "[YouVerifyWorker] Processing event"
  );

  // ── Resolve the user by YouVerify's reference or customer ID ───────────────
  // YouVerify typically echoes back your own reference field or a customer
  // identifier that you set at the time of the verification request.
  const externalReference: string =
    data.metadata?.customerId || data.customerId || data.reference || "";

  if (!externalReference) {
    logger.warn(
      { jobId: job.id, payload },
      "[YouVerifyWorker] Missing customer reference — cannot resolve user"
    );
    return;
  }

  const user = await User.findById(externalReference).catch(() => null)
    ?? await User.findOne({ emailAddress: externalReference });

  if (!user) {
    logger.warn(
      { externalReference },
      "[YouVerifyWorker] User not found for YouVerify reference"
    );
    return;
  }

  const previousStatus = user.identityVerificationStatus;

  // ── Map YouVerify event to internal status ──────────────────────────────────
  let newStatus: typeof user.identityVerificationStatus = previousStatus;

  const yvStatus = (data.status || "").toLowerCase();

  if (
    eventType.includes("completed") ||
    eventType.includes("success")
  ) {
    newStatus = yvStatus === "found" || yvStatus === "verified"
      ? "VERIFIED"
      : "FAILED";
  } else if (eventType.includes("failed")) {
    newStatus = "FAILED";
  } else if (
    eventType.includes("manual_review") ||
    yvStatus === "manual_review"
  ) {
    newStatus = "MANUAL_REVIEW";
  } else {
    // Unknown event type — log and skip state mutation
    logger.warn(
      { eventType, yvStatus },
      "[YouVerifyWorker] Unrecognized event type — skipping status mutation"
    );
    return;
  }

  // Guard: never regress a terminal status
  if (previousStatus === "VERIFIED" && newStatus !== "VERIFIED") {
    logger.warn(
      { userId: user._id.toString(), previousStatus, newStatus },
      "[YouVerifyWorker] Refusing to regress from VERIFIED"
    );
    return;
  }

  user.identityVerificationStatus = newStatus;
  user.identityVerificationResponse = JSON.stringify({
    provider: "YouVerify",
    eventType,
    timestamp: new Date().toISOString(),
    rawResponse: payload,
  });
  await user.save();

  logger.info(
    { userId: user._id.toString(), previousStatus, newStatus },
    "[YouVerifyWorker] User identity verification status updated"
  );

  await logAudit(
    user._id.toString(),
    "IDENTITY_VERIFICATION_WEBHOOK_RECEIVED",
    user._id.toString(),
    { identityVerificationStatus: previousStatus },
    { identityVerificationStatus: newStatus, eventType }
  );

  // ── Advance PaymentOrders blocked on this user's verification ───────────────
  if (newStatus === "VERIFIED") {
    const blockedOrders = await PaymentOrder.find({
      customerId: user._id,
      status: "UNDER_VERIFICATION",
    });

    for (const order of blockedOrders) {
      logger.info(
        { paymentOrderId: order._id.toString() },
        "[YouVerifyWorker] Re-triggering check_verification for unblocked order"
      );

      await queueService.addJob(
        "process-settlement",
        "check_verification",
        { paymentOrderId: order._id.toString() },
        `check-verification:${order._id.toString()}:after-yv-webhook`
      );
    }
  }
};
