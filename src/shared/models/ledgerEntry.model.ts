import { Schema, model, Document, Types } from "mongoose";

export interface ILedgerEntry extends Document {
  transactionId: Types.ObjectId;
  customerId: Types.ObjectId;
  provider: string;
  providerReference: string;
  currency: string;
  amount: number;
  debitAccount: string;
  creditAccount: string;
  status: string;
  effectiveAt: Date;
  createdAt: Date;
}

const LedgerEntrySchema = new Schema<ILedgerEntry>(
  {
    transactionId: { type: Schema.Types.ObjectId, ref: "PaymentOrder", required: true },
    customerId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    provider: { type: String, required: true },
    providerReference: { type: String, required: true, unique: true },
    currency: { type: String, required: true },
    amount: { type: Number, required: true },
    debitAccount: { type: String, required: true },
    creditAccount: { type: String, required: true },
    status: { type: String, required: true, default: "POSTED" },
    effectiveAt: { type: Date, required: true },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

export const LedgerEntry = model<ILedgerEntry>("LedgerEntry", LedgerEntrySchema);
