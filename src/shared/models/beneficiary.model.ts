import { Schema, model, Document, Types } from "mongoose";

export interface IBeneficiary extends Document {
  legalName: string;
  beneficiaryType: string;
  country: string;
  businessAddress: string;
  bankName: string;
  accountCurrency: string;
  paymentRail: string;
  maskedAccountNumber: string;
  swiftBic?: string;
  ibanLastFour?: string;
  verificationStatus: string;
  createdAt: Date;
  updatedAt: Date;
}

const BeneficiarySchema = new Schema<IBeneficiary>(
  {
    legalName: { type: String, required: true },
    beneficiaryType: { type: String, required: true },
    country: { type: String, required: true },
    businessAddress: { type: String, required: true },
    bankName: { type: String, required: true },
    accountCurrency: { type: String, required: true },
    paymentRail: { type: String, required: true },
    maskedAccountNumber: { type: String, required: true },
    swiftBic: { type: String },
    ibanLastFour: { type: String },
    verificationStatus: { type: String, required: true, default: "DRAFT" },
  },
  { timestamps: true }
);

export const Beneficiary = model<IBeneficiary>("Beneficiary", BeneficiarySchema);

export interface IBridgeExternalAccountMapping extends Document {
  beneficiaryId: Types.ObjectId;
  freigentaCustomerId: Types.ObjectId;
  bridgeCustomerId: string;
  bridgeExternalAccountId: string;
  status: string;
  createdAt: Date;
  updatedAt: Date;
}

const BridgeExternalAccountMappingSchema = new Schema<IBridgeExternalAccountMapping>(
  {
    beneficiaryId: { type: Schema.Types.ObjectId, ref: "Beneficiary", required: true },
    freigentaCustomerId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    bridgeCustomerId: { type: String, required: true },
    bridgeExternalAccountId: { type: String, required: true, unique: true },
    status: { type: String, required: true, default: "PENDING_REVIEW" },
  },
  { timestamps: true }
);

export const BridgeExternalAccountMapping = model<IBridgeExternalAccountMapping>("BridgeExternalAccountMapping", BridgeExternalAccountMappingSchema);
