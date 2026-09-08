import mongoose from "mongoose";
import { LedgerEntry } from "../models/ledgerEntry.model";
import { AppError } from "../utils/AppError";
import { logger } from "../utils/logger";

/**
 * Double-entry ledger service.
 *
 * Every financial movement is recorded as a balanced double-entry:
 *   Debit Account ← Amount → Credit Account
 *
 * The entry is written inside a MongoDB session/transaction to ensure
 * atomicity. If the write fails, the session is aborted and the caller
 * receives an AppError — ensuring no half-written ledger state.
 *
 * Current implementation stores both sides in a single document (the
 * debit_account and credit_account columns satisfy Section 29 of the spec).
 * A future iteration should use two mirrored rows for stricter accounting.
 */
export class LedgerService {
  public async postDoubleEntry(
    transactionId: string,
    customerId: string,
    provider: string,
    providerReference: string,
    currency: string,
    amount: number,
    debitAccount: string,
    creditAccount: string
  ): Promise<void> {
    if (amount <= 0) {
      throw new AppError("Ledger entry amount must be greater than zero", 400);
    }

    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      await LedgerEntry.create(
        [
          {
            transactionId,
            customerId,
            provider,
            providerReference,
            currency,
            amount,
            debitAccount,
            creditAccount,
            status: "POSTED",
            effectiveAt: new Date(),
          },
        ],
        { session }
      );

      await session.commitTransaction();

      logger.info(
        { transactionId, provider, providerReference, amount, currency },
        "[LedgerService] Double-entry posted"
      );
    } catch (error) {
      await session.abortTransaction();
      logger.error(
        { err: error, transactionId, provider },
        "[LedgerService] Failed to post ledger entry — transaction aborted"
      );
      throw new AppError("Failed to post ledger entry", 500);
    } finally {
      session.endSession();
    }
  }
}

export const ledgerService = new LedgerService();
