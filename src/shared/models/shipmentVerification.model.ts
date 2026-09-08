import mongoose, { Document, Schema } from 'mongoose';

export interface IShipmentVerification extends Document {
  invoiceId: mongoose.Types.ObjectId;
  customerId: mongoose.Types.ObjectId;
  providerEventId?: string;
  trackingNumber: string;
  type: 'CONTAINER' | 'BOOKING';
  status: 'PENDING' | 'VERIFIED' | 'VERIFIED_WITH_WARNINGS' | 'MANUAL_REVIEW_REQUIRED' | 'FAILED' | 'PROVIDER_UNAVAILABLE';
  rawResponse: any;
  extractedData: {
    carrier?: string;
    vessel?: string;
    voyage?: string;
    route?: string;
    events?: any[];
  };
  mismatches?: string[];
  createdAt: Date;
  updatedAt: Date;
}

const ShipmentVerificationSchema = new Schema<IShipmentVerification>({
  invoiceId: { type: Schema.Types.ObjectId, ref: 'Invoice', required: true },
  customerId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  providerEventId: { type: String },
  trackingNumber: { type: String, required: true },
  type: { type: String, enum: ['CONTAINER', 'BOOKING'], required: true },
  status: {
    type: String,
    enum: ['PENDING', 'VERIFIED', 'VERIFIED_WITH_WARNINGS', 'MANUAL_REVIEW_REQUIRED', 'FAILED', 'PROVIDER_UNAVAILABLE'],
    default: 'PENDING'
  },
  rawResponse: { type: Schema.Types.Mixed },
  extractedData: {
    carrier: { type: String },
    vessel: { type: String },
    voyage: { type: String },
    route: { type: String },
    events: [{ type: Schema.Types.Mixed }]
  },
  mismatches: [{ type: String }]
}, { timestamps: true });

export const ShipmentVerification = mongoose.model<IShipmentVerification>('ShipmentVerification', ShipmentVerificationSchema);
