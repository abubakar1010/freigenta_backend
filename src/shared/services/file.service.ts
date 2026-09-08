import crypto from "crypto";
import path from "path";
import {
  StoredFile,
  IStoredFile,
  FilePurpose,
  FileVisibility,
  FileStorage,
  PUBLIC_PURPOSES,
  FILE_STAFF_ROLES,
} from "../models/storedFile.model";
import {
  primaryStore,
  localStore,
  storageDriver,
} from "./storage.service";
import { AppError } from "../utils/AppError";
import { logger } from "../utils/logger";

/**
 * Upload orchestration: naming, content validation, persistence of the
 * ownership record, and the URL shape the rest of the app stores.
 *
 * Every write goes through storeUpload(), so the content checks here cannot be
 * bypassed by a new call site — which is exactly how the invoice controller's
 * supporting documents previously skipped validation entirely.
 */

/** Declared type -> the bytes we require to actually be there. */
const MAGIC: Array<{ type: string; ext: string; bytes: number[] }> = [
  { type: "image/jpeg", ext: "jpg", bytes: [0xff, 0xd8, 0xff] },
  { type: "image/png", ext: "png", bytes: [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a] },
  { type: "application/pdf", ext: "pdf", bytes: [0x25, 0x50, 0x44, 0x46, 0x2d] },
];

/**
 * Identifies a buffer by its leading bytes.
 *
 * express-fileupload reports the MIME type the client put in the multipart
 * header, which is trivially forged. Serving a forged type back from our own
 * origin would be stored XSS, so the sniffed value is what gets stored.
 */
export const sniffContentType = (buffer: Buffer): string | null => {
  for (const sig of MAGIC) {
    if (buffer.length < sig.bytes.length) continue;
    if (sig.bytes.every((b, i) => buffer[i] === b)) return sig.type;
  }
  return null;
};

const extensionFor = (contentType: string): string =>
  MAGIC.find((m) => m.type === contentType)?.ext ?? "bin";

/**
 * Reduces a client-supplied filename to something safe to place in a key.
 *
 * The previous implementation interpolated this straight into a path.join(),
 * so a name of "../../../dist/app.js" escaped the upload directory.
 */
export const sanitizeFilename = (name: string): string => {
  const base = path.basename(name || "");
  const cleaned = base
    .replace(/[^A-Za-z0-9._-]/g, "-")
    .replace(/\.{2,}/g, ".")
    .replace(/^[.-]+/, "")
    .slice(0, 100);
  return cleaned || "file";
};

/**
 * The display name for a stored object: the client's name, sanitised, with the
 * extension replaced by the one matching the sniffed content type. Used for
 * both the key and the Content-Disposition filename so neither can claim the
 * file is something it is not.
 */
export const safeDisplayName = (
  originalName: string,
  contentType: string
): string => {
  const base = sanitizeFilename(originalName).replace(/\.[^.]*$/, "") || "file";
  return `${base}.${extensionFor(contentType)}`;
};

export const visibilityFor = (purpose: FilePurpose): FileVisibility =>
  PUBLIC_PURPOSES.includes(purpose) ? "PUBLIC" : "PRIVATE";

/**
 * Key layout: <visibility>/<purpose>/<scope>/<yyyy>/<mm>/<uuid>/<filename>
 *
 * The leading segment is the authorization discriminator — marketing images
 * must stay fetchable by a logged-out browser, which cannot send an
 * Authorization header on an <img> tag.
 *
 * The original filename sits last so that consumers deriving a display name
 * with url.split("/").pop() keep working, and get a real name rather than a
 * timestamped blob.
 */
export const buildKey = (opts: {
  visibility: FileVisibility;
  purpose: FilePurpose;
  scope: string;
  originalName: string;
  contentType: string;
}): string => {
  const now = new Date();
  const yyyy = now.getUTCFullYear();
  const mm = String(now.getUTCMonth() + 1).padStart(2, "0");

  const name = safeDisplayName(opts.originalName, opts.contentType);

  return [
    opts.visibility.toLowerCase(),
    opts.purpose,
    opts.scope,
    yyyy,
    mm,
    // randomUUID is a CSPRNG. The previous Date.now()+Math.random() scheme was
    // guessable; key secrecy is not a control here either way, but weak keys
    // shouldn't be handed out.
    crypto.randomUUID(),
    name,
  ].join("/");
};

const appBase = (): string =>
  (process.env.APP_URL || `http://localhost:${process.env.PORT || 8080}`).replace(/\/+$/, "");

export const toFileUrl = (key: string): string => `${appBase()}/api/files/${key}`;

/**
 * Recovers the object key from a URL previously stored in Mongo.
 *
 * Deliberately host-agnostic: it matches on the /api/files/ path segment only,
 * so moving the API to a new domain does not orphan every existing record.
 */
export const keyFromStoredUrl = (stored: string): string | null => {
  if (!stored) return null;
  const marker = "/api/files/";
  const at = stored.indexOf(marker);
  if (at === -1) return null;
  const key = stored.slice(at + marker.length).split("?")[0];
  return key || null;
};

export interface UploadInput {
  buffer: Buffer;
  originalName: string;
  purpose: FilePurpose;
  /** Set for uploads made with a session; null for onboarding uploads. */
  ownerId?: string | null;
  /** Claim handle when the account does not exist yet. */
  ownerPhone?: string | null;
  ip?: string;
}

export interface UploadResult {
  key: string;
  url: string;
  contentType: string;
  size: number;
}

export const storeUpload = async (input: UploadInput): Promise<UploadResult> => {
  const contentType = sniffContentType(input.buffer);
  if (!contentType) {
    throw new AppError(
      "Unrecognised file contents. Only JPEG, PNG and PDF files are accepted.",
      400
    );
  }

  const visibility = visibilityFor(input.purpose);
  const key = buildKey({
    visibility,
    purpose: input.purpose,
    scope: input.ownerId ? String(input.ownerId) : "unclaimed",
    originalName: input.originalName,
    contentType,
  });

  let storage: FileStorage = storageDriver;
  try {
    await primaryStore.putObject(key, input.buffer, contentType);
  } catch (error: any) {
    if (storageDriver !== "r2") throw error;

    // Retained deliberately so a provider blip does not lose a customer's
    // document mid-onboarding. It is recorded per object rather than left
    // implicit, so the two storage locations stay distinguishable afterwards.
    logger.error(
      { err: error.message, key, purpose: input.purpose },
      "[Storage] R2 write failed — falling back to local disk. This object will " +
        "NOT survive a redeploy; re-upload it once R2 is healthy."
    );
    await localStore.putObject(key, input.buffer, contentType);
    storage = "local";
  }

  await StoredFile.create({
    key,
    ownerId: input.ownerId || null,
    ownerPhone: input.ownerPhone || null,
    purpose: input.purpose,
    visibility,
    storage,
    contentType,
    size: input.buffer.length,
    sha256: crypto.createHash("sha256").update(input.buffer).digest("hex"),
    originalName: safeDisplayName(input.originalName, contentType),
    uploadedByIp: input.ip,
  });

  return { key, url: toFileUrl(key), contentType, size: input.buffer.length };
};

/**
 * Read rule, kept deliberately small: public objects are open, private objects
 * belong to their owner, and staff may read anything.
 */
export const canAccess = (
  file: IStoredFile,
  user?: { userId: string; role: string }
): boolean => {
  if (file.visibility === "PUBLIC") return true;
  if (!user) return false;
  if (FILE_STAFF_ROLES.includes((user.role || "").toUpperCase())) return true;
  return !!file.ownerId && String(file.ownerId) === user.userId;
};

/**
 * Attaches onboarding uploads to the account once it exists. Called from
 * createAccount, keyed on the phone number the OTP was verified against.
 */
export const claimFilesForPhone = async (
  phone: string,
  ownerId: string
): Promise<number> => {
  const res = await StoredFile.updateMany(
    { ownerPhone: phone.toLowerCase(), ownerId: null },
    { $set: { ownerId } }
  );
  return res.modifiedCount ?? 0;
};
