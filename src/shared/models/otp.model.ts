import { Schema, model, Document } from "mongoose";

export interface IOtp extends Document {
  identifier: string;        // email or phone number
  type: "EMAIL" | "PHONE";
  code: string;              // hashed OTP stored in DB
  attempts: number;          // number of wrong attempts
  isVerified: boolean;
  expiresAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const OtpSchema = new Schema<IOtp>(
  {
    identifier: { type: String, required: true, lowercase: true },
    type:       { type: String, enum: ["EMAIL", "PHONE"], required: true },
    code:       { type: String, required: true },
    attempts:   { type: Number, default: 0 },
    isVerified: { type: Boolean, default: false },
    expiresAt:  { type: Date, required: true },
  },
  { timestamps: true }
);

// MongoDB auto-deletes expired OTP documents 1 hour after they expire
OtpSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 3600 });
OtpSchema.index({ identifier: 1, type: 1 });

export const Otp = model<IOtp>("Otp", OtpSchema);
