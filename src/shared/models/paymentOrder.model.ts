import { Schema, model, Document, Types } from "mongoose";

export interface IPaymentOrder extends Document {
  transactionReference: string;
  customerId: Types.ObjectId;
  invoiceId: Types.ObjectId;
  invoiceCurrency: string;
  invoiceAmount: number;
  collectionCurrency: string;
  expectedCollectionAmount: number;
  receivedCollectionAmount: number;
  serviceFee: number;
  fxMargin: number;
  estimatedProviderFees: number;
  beneficiaryAmount: number;
  quoteRate: number;
  quoteExpiry: Date;
  escaVirtualAccountId?: string;
  bridgeCustomerId?: string;
  status: string;
  createdAt: Date;
  updatedAt: Date;
}

const PaymentOrderSchema = new Schema<IPaymentOrder>(
  {
    transactionReference: { type: String, required: true, unique: true },
    customerId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    invoiceId: { type: Schema.Types.ObjectId, ref: "Invoice", required: true },
    invoiceCurrency: { type: String, required: true },
    invoiceAmount: { type: Number, required: true },
    collectionCurrency: { type: String, required: true },
    expectedCollectionAmount: { type: Number, required: true },
    receivedCollectionAmount: { type: Number, default: 0 },
    serviceFee: { type: Number, default: 0 },
    fxMargin: { type: Number, default: 0 },
    estimatedProviderFees: { type: Number, default: 0 },
    beneficiaryAmount: { type: Number, required: true },
    quoteRate: { type: Number, required: true },
    quoteExpiry: { type: Date, required: true },
    escaVirtualAccountId: { type: String },
    bridgeCustomerId: { type: String },
    status: {
      type: String,
      enum: [
        "DRAFT",
        "DOCUMENT_RECEIVED",
        "QUOTE_READY",
        "AWAITING_PAYMENT",
        "PAYMENT_UNDERPAID",
        "PAYMENT_OVERPAID",
        "PAYMENT_REVIEW_REQUIRED",
        "PAYMENT_RECEIVED",
        "PAID_PENDING_VERIFICATION",
        "UNDER_VERIFICATION",
        "CUSTOMER_ACTION_REQUIRED",
        "VERIFICATION_FAILED",
        "VERIFIED_PENDING_SETTLEMENT",
        "SETTLEMENT_APPROVAL_PENDING",
        "ESCA_CONVERSION_PENDING",
        "ESCA_CONVERSION_PROCESSING",
        "ESCA_CONVERSION_COMPLETED",
        "ESCA_TRANSFER_TO_BRIDGE_PENDING",
        "ESCA_TRANSFER_TO_BRIDGE_SUBMITTED",
        "BRIDGE_FUNDING_PENDING",
        "BRIDGE_FUNDS_RECEIVED",
        "PAYOUT_PENDING",
        "PAYOUT_SUBMITTED",
        "PAYOUT_PROCESSING",
        "CARRIER_PAID",
        "RECONCILIATION_PENDING",
        "COMPLETED",
        "REFUND_PENDING",
        "REFUND_PROCESSING",
        "REFUNDED",
        "MANUAL_REVIEW",
        "FAILED",
        "CANCELED",
      ],
      default: "DRAFT",
      required: true,
    },
  },
  { timestamps: true }
);

// ── Indexes ───────────────────────────────────────────────────────────────────
// transactionReference has unique:true above which auto-creates a unique index.

// Compound index for the most common admin/ops query pattern:
// "Give me all orders for customer X with status Y"
PaymentOrderSchema.index({ customerId: 1, status: 1 });

// For the Esca webhook worker which looks up by transactionReference
PaymentOrderSchema.index({ transactionReference: 1 });

// For the Bridge webhook worker which looks up by bridgeCustomerId + status
PaymentOrderSchema.index({ bridgeCustomerId: 1, status: 1 });

// Dashboard queries typically sort by createdAt descending
PaymentOrderSchema.index({ createdAt: -1 });

export const PaymentOrder = model<IPaymentOrder>("PaymentOrder", PaymentOrderSchema);
