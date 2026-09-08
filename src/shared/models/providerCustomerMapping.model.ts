import { Schema, model, Document, Types } from "mongoose";

export interface IProviderCustomerMapping extends Document {
  freigentaCustomerId: Types.ObjectId;
  provider: string; // e.g., 'esca', 'bridge'
  providerCustomerId: string;
  providerStatus: string;
  kycStatus: string;
  kybStatus: string;
  tosStatus: string;
  endorsementStatus: string;
  createdAt: Date;
  updatedAt: Date;
}

const ProviderCustomerMappingSchema = new Schema<IProviderCustomerMapping>(
  {
    freigentaCustomerId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    provider: { type: String, required: true },
    providerCustomerId: { type: String, required: true },
    providerStatus: { type: String },
    kycStatus: { type: String },
    kybStatus: { type: String },
    tosStatus: { type: String },
    endorsementStatus: { type: String },
  },
  { timestamps: true }
);

ProviderCustomerMappingSchema.index({ freigentaCustomerId: 1, provider: 1 }, { unique: true });

export const ProviderCustomerMapping = model<IProviderCustomerMapping>("ProviderCustomerMapping", ProviderCustomerMappingSchema);
