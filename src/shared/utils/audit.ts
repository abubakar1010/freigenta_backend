import { AuditLog } from "../models/audit.model";
import { Types } from "mongoose";
import { logger } from "./logger";

/**
 * Appends an immutable audit log entry.
 *
 * Audit logs are fire-and-forget: failures are logged but never bubble up
 * to the caller. An audit write failure must NEVER abort a financial
 * transaction — the financial record itself is source of truth.
 *
 * @param actorId        - ObjectId of the user or system actor performing the action
 * @param event          - Uppercase snake_case event name (e.g. "QUOTE_ACCEPTED")
 * @param relatedRecordId - ObjectId (as string) of the primary affected record
 * @param previousValue  - State before the mutation (for change tracking)
 * @param newValue       - State after the mutation
 * @param ipAddress      - Originating request IP (for security audits)
 */
export async function logAudit(
  actorId: Types.ObjectId | string,
  event: string,
  relatedRecordId?: string,
  previousValue?: Record<string, any>,
  newValue?: Record<string, any>,
  ipAddress?: string
): Promise<void> {
  try {
    await AuditLog.create({
      actorId: new Types.ObjectId(actorId.toString()),
      event,
      relatedRecordId,
      previousValue,
      newValue,
      ipAddress,
    });
  } catch (error) {
    // Non-fatal: log the failure but do NOT re-throw
    logger.error(
      { err: error, event, actorId: actorId.toString() },
      "[Audit] Failed to persist audit log entry"
    );
  }
}
