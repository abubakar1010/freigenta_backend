import { Schema, model, Document } from "mongoose";

export interface IContactInfo extends Document {
  email: string;
  phone: string;
  businessHours: string[];
  address: string;
  mapUrl: string;
  createdAt: Date;
  updatedAt: Date;
}

const ContactInfoSchema = new Schema<IContactInfo>(
  {
    email: { type: String, required: true, trim: true },
    phone: { type: String, required: true, trim: true },
    businessHours: { type: [String], required: true },
    address: { type: String, required: true, trim: true },
    mapUrl: { type: String, required: true, trim: true }
  },
  { timestamps: true }
);

export const ContactInfo = model<IContactInfo>("ContactInfo", ContactInfoSchema);
