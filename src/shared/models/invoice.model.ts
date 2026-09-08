import { Schema, model, Document, Types } from "mongoose";

export interface IInvoice extends Document {
  invoiceNo: string;
  customerId: Types.ObjectId;
  carrier: string;
  invoiceDate?: Date;
  invoiceDueDate?: Date;
  currency: string;
  amount: number;
  fileUrl: string;
  status: "UPLOADED" | "PROCESSING" | "MANUAL_REVIEW" | "QUOTE_READY" | "AWAITING_PAYMENT" | "SETTLING" | "REJECTED" | "CANCELLED" | "COMPLETED";
  ocrConfidence?: number;
  extractedData?: Record<string, any>;
  createdAt?: Date;
  updatedAt?: Date;
}

const InvoiceSchema = new Schema<IInvoice>(
  {
    invoiceNo: { type: String, required: true, unique: true },
    customerId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    carrier: { type: String, required: true },
    invoiceDate: { type: Date },
    invoiceDueDate: { type: Date },
    currency: { type: String, required: true, default: "USD" },
    amount: { type: Number, required: true },
    fileUrl: { type: String, required: true },
    status: {
      type: String,
      enum: ["UPLOADED", "PROCESSING", "MANUAL_REVIEW", "QUOTE_READY", "AWAITING_PAYMENT", "SETTLING", "REJECTED", "CANCELLED", "COMPLETED"],
      default: "UPLOADED",
    },
    ocrConfidence: { type: Number, default: 100 },
    extractedData: { type: Schema.Types.Mixed },
  },
  { timestamps: true }
);

InvoiceSchema.index({ customerId: 1, status: 1 });
InvoiceSchema.index({ customerId: 1, createdAt: -1 });

export const Invoice = model<IInvoice>("Invoice", InvoiceSchema);

