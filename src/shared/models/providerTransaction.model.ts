import { Schema, model, Document, Types } from "mongoose";

export interface IProviderTransaction extends Document {
  paymentOrderId: Types.ObjectId;
  provider: string;
  providerTransactionType: string;
  providerTransactionId: string;
  idempotencyKey: string;
  currency: string;
  amount: number;
  status: string;
  rawResponse: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}

const ProviderTransactionSchema = new Schema<IProviderTransaction>(
  {
    paymentOrderId: {
      type: Schema.Types.ObjectId,
      ref: "PaymentOrder",
      required: true,
    },
    provider: { type: String, required: true },
    providerTransactionType: { type: String, required: true },
    providerTransactionId: { type: String, required: true },
    idempotencyKey: { type: String, required: true, unique: true },
    currency: { type: String, required: true },
    amount: { type: Number, required: true },
    status: { type: String, required: true },
    rawResponse: { type: Schema.Types.Mixed },
  },
  { timestamps: true }
);

// ── Indexes ───────────────────────────────────────────────────────────────────
// idempotencyKey has unique:true above — provides the primary idempotency guard.

// Bridge/Esca webhook workers look up by (providerTransactionId, provider)
ProviderTransactionSchema.index(
  { providerTransactionId: 1, provider: 1 },
  { unique: true }
);

// For loading all provider events for a given payment order
ProviderTransactionSchema.index({ paymentOrderId: 1, provider: 1 });

export const ProviderTransaction = model<IProviderTransaction>(
  "ProviderTransaction",
  ProviderTransactionSchema
);
