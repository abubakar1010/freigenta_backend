import { Schema, model, Document, Types } from "mongoose";

/**
 * Ownership record for every uploaded object.
 *
 * Without this, "authenticated" is the only possible authorization rule, and
 * registration is open self-service — so any account created a minute ago
 * could read every other customer's identity document. This row is what makes
 * "your own files, or staff" expressible.
 */

export type FilePurpose =
  | "onboarding"
  | "kyc"
  | "invoice"
  | "profile"
  | "news"
  | "settings";

export type FileVisibility = "PUBLIC" | "PRIVATE";
export type FileStorage = "r2" | "local";

/** Purposes whose objects are readable without a token. Server-decided. */
export const PUBLIC_PURPOSES: FilePurpose[] = ["news", "settings"];

/** Roles allowed to read any file, regardless of owner. */
export const FILE_STAFF_ROLES = ["ADMIN", "OPS", "COMPLIANCE", "TREASURY"];

export interface IStoredFile extends Document {
  key: string;
  /** Null until an onboarding upload is claimed by the account it belongs to. */
  ownerId?: Types.ObjectId | null;
  /** Claim handle for uploads made before the account exists. */
  ownerPhone?: string | null;
  purpose: FilePurpose;
  visibility: FileVisibility;
  /**
   * Which backend actually holds the bytes. The runtime fallback can write to
   * local disk when R2 is unreachable, so this must be recorded per object —
   * otherwise the collection becomes a mix of R2 and container-local files
   * with no way to tell them apart after the fact.
   */
  storage: FileStorage;
  /** Sniffed from the file body, never the client-declared header. */
  contentType: string;
  size: number;
  sha256: string;
  originalName: string;
  uploadedByIp?: string;
  createdAt: Date;
  updatedAt: Date;
}

const StoredFileSchema = new Schema<IStoredFile>(
  {
    key: { type: String, required: true, unique: true, index: true },
    ownerId: { type: Schema.Types.ObjectId, ref: "User", default: null },
    ownerPhone: { type: String, default: null },
    purpose: {
      type: String,
      enum: ["onboarding", "kyc", "invoice", "profile", "news", "settings"],
      required: true,
    },
    visibility: {
      type: String,
      enum: ["PUBLIC", "PRIVATE"],
      required: true,
      default: "PRIVATE",
    },
    storage: { type: String, enum: ["r2", "local"], required: true },
    contentType: { type: String, required: true },
    size: { type: Number, required: true },
    sha256: { type: String, required: true },
    originalName: { type: String, required: true },
    uploadedByIp: { type: String },
  },
  { timestamps: true }
);

// Serves the claim query in createAccount: find this phone's unclaimed uploads.
StoredFileSchema.index({ ownerPhone: 1, ownerId: 1 });

export const StoredFile = model<IStoredFile>("StoredFile", StoredFileSchema);
