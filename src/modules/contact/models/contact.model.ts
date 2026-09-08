import { Schema, model, Document } from "mongoose";

export interface IContact extends Document {
  fullName: string;
  email: string;
  companyName?: string;
  number?: string;
  message: string;
  status: "Pending" | "Reviewed" | "Resolved";
  createdAt: Date;
  updatedAt: Date;
}

const ContactSchema = new Schema<IContact>(
  {
    fullName: { type: String, required: true, trim: true },
    email: { type: String, required: true, trim: true },
    companyName: { type: String, trim: true },
    number: { type: String, trim: true },
    message: { type: String, required: true, trim: true },
    status: {
      type: String,
      enum: ["Pending", "Reviewed", "Resolved"],
      default: "Pending"
    }
  },
  { timestamps: true }
);

export const Contact = model<IContact>("Contact", ContactSchema);
