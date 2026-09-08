import { Schema, model, Document } from "mongoose";

export interface IBankAccount extends Document {
  bankName: string;
  bankColor: string;
  accountHolder: string;
  accountType: string;
  currency: string;
  accountNumber: string;
  swiftCode?: string;
  createdAt: Date;
  updatedAt: Date;
}

const BankAccountSchema = new Schema<IBankAccount>(
  {
    bankName: { type: String, required: true, trim: true },
    bankColor: { type: String, default: "bg-emerald-600" },
    accountHolder: { type: String, required: true, trim: true },
    accountType: { type: String, required: true, trim: true, default: "Current Account" },
    currency: { type: String, required: true, trim: true, default: "USD" },
    accountNumber: { type: String, required: true, trim: true },
    swiftCode: { type: String, trim: true }
  },
  { timestamps: true }
);

export const BankAccount = model<IBankAccount>("BankAccount", BankAccountSchema);
