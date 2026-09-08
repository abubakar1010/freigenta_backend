import { Schema, model, Document, Types } from "mongoose";

export interface IQuote extends Document {
  invoiceId: Types.ObjectId;
  amountPayable: number;
  paymentCurrency: string;
  freightInvoiceAmount: number;
  conversionRate: number;
  freigentaTransactionFee: number;
  freigentaFXMargin: number;
  expiryDate: Date;
  status: "DRAFT" | "PENDING_APPROVAL" | "READY" | "SENT" | "ACCEPTED" | "DECLINED" | "EXPIRED" | "CANCELLED";
}

const QuoteSchema = new Schema<IQuote>(
  {
    invoiceId: { type: Schema.Types.ObjectId, ref: "Invoice", required: true },
    amountPayable: { type: Number, required: true },
    paymentCurrency: { type: String, required: true, default: "NGN" },
    freightInvoiceAmount: { type: Number, required: true },
    conversionRate: { type: Number, required: true },
    freigentaTransactionFee: { type: Number, required: true },
    freigentaFXMargin: { type: Number, required: true },
    expiryDate: { type: Date, required: true },
    status: {
      type: String,
      enum: ["DRAFT", "PENDING_APPROVAL", "READY", "SENT", "ACCEPTED", "DECLINED", "EXPIRED", "CANCELLED"],
      default: "DRAFT",
    },
  },
  { timestamps: true }
);

export const Quote = model<IQuote>("Quote", QuoteSchema);
