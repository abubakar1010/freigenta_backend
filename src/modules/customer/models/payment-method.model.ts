import { Schema, model, Document, Types } from "mongoose";

export interface IPaymentMethod extends Document {
  customerId: Types.ObjectId;
  bankName: string;
  accountHolder: string;
  accountType: string;
  currency: string;
  accountNumber: string;
  initials: string;
  createdAt?: Date;
  updatedAt?: Date;
}

const PaymentMethodSchema = new Schema<IPaymentMethod>(
  {
    customerId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    bankName: { type: String, required: true },
    accountHolder: { type: String, required: true },
    accountType: { type: String, required: true, default: "Current Account" },
    currency: { type: String, required: true, default: "USD" },
    accountNumber: { type: String, required: true },
    initials: { type: String, required: true }
  },
  { timestamps: true }
);

export const PaymentMethod = model<IPaymentMethod>("PaymentMethod", PaymentMethodSchema);
