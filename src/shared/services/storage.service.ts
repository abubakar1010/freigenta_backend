import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
} from "@aws-sdk/client-s3";
import fs from "fs";
import path from "path";
import { Readable } from "stream";
import { requireEnv } from "../utils/env";
import { logger } from "../utils/logger";

/**
 * Byte-level object storage. Knows nothing about users, URLs or Mongo — that
 * orchestration lives in file.service.ts.
 *
 * Cloudflare R2 speaks the S3 API, so @aws-sdk/client-s3 drives it. The client
 * options below are not interchangeable with an AWS S3 client; see below.
 */

export type StorageDriver = "r2" | "local";

export interface FetchedObject {
  body: Readable;
  contentLength?: number;
  contentType?: string;
  /** Set only when a Range request was satisfied. */
  contentRange?: string;
  statusCode: 200 | 206;
}

export interface ObjectStore {
  readonly driver: StorageDriver;
  putObject(key: string, body: Buffer, contentType: string): Promise<void>;
  getObject(key: string, range?: string): Promise<FetchedObject>;
}

// ─── Cloudflare R2 ───────────────────────────────────────────────────────────

class R2Store implements ObjectStore {
  readonly driver: StorageDriver = "r2";
  private _client: S3Client | null = null;
  private _bucket: string | null = null;

  private get bucket(): string {
    if (!this._bucket) this._bucket = requireEnv("R2_BUCKET");
    return this._bucket;
  }

  private get client(): S3Client {
    if (this._client) return this._client;

    const accountId = requireEnv(
      "R2_ACCOUNT_ID",
      "Found in the Cloudflare dashboard under R2."
    );
    const endpoint =
      process.env.R2_ENDPOINT ||
      `https://${accountId}.r2.cloudflarestorage.com`;

    this._client = new S3Client({
      // SigV4 requires a region; R2 accepts the literal "auto".
      region: "auto",
      // The endpoint carries no bucket, so the bucket goes in the path.
      endpoint,
      forcePathStyle: true,
      credentials: {
        accessKeyId: requireEnv("R2_ACCESS_KEY_ID"),
        secretAccessKey: requireEnv("R2_SECRET_ACCESS_KEY"),
      },
      // Load-bearing. From v3.729 the SDK attaches x-amz-checksum-crc32 with
      // aws-chunked streaming trailers to PutObject, which R2 rejects — the
      // error surfaces as an opaque signature mismatch. This project is on
      // 3.1107.0, well past that. Set per-client and NEVER via the
      // AWS_REQUEST_CHECKSUM_CALCULATION env var, which would also reach the
      // SNS client in sms.service.ts.
      requestChecksumCalculation: "WHEN_REQUIRED",
      responseChecksumValidation: "WHEN_REQUIRED",
    });

    logger.info({ endpoint, bucket: this.bucket }, "[Storage] R2 client ready");
    return this._client;
  }

  async putObject(key: string, body: Buffer, contentType: string): Promise<void> {
    // No ACL parameter: R2 does not implement object ACLs and rejects them.
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: body,
        ContentType: contentType,
      })
    );
  }

  async getObject(key: string, range?: string): Promise<FetchedObject> {
    const res = await this.client.send(
      new GetObjectCommand({ Bucket: this.bucket, Key: key, Range: range })
    );

    return {
      body: res.Body as Readable,
      contentLength: res.ContentLength,
      contentType: res.ContentType,
      contentRange: res.ContentRange,
      statusCode: res.ContentRange ? 206 : 200,
    };
  }
}

// ─── Local disk ──────────────────────────────────────────────────────────────

/**
 * Development driver, and the destination of the runtime fallback.
 *
 * Resolves to <project root>/uploads — from dist/shared/services that is three
 * levels up, matching where server.ts used to serve static files from.
 */
const LOCAL_ROOT = path.join(__dirname, "../../../uploads");

class LocalStore implements ObjectStore {
  readonly driver: StorageDriver = "local";

  /**
   * Keys contain slashes, so a crafted key could otherwise escape the upload
   * directory. Every read and write resolves through here first.
   */
  private resolve(key: string): string {
    const full = path.resolve(LOCAL_ROOT, key);
    if (full !== LOCAL_ROOT && !full.startsWith(LOCAL_ROOT + path.sep)) {
      throw new Error(`[Storage] Refusing key that escapes the upload root: ${key}`);
    }
    return full;
  }

  async putObject(key: string, body: Buffer): Promise<void> {
    const full = this.resolve(key);
    await fs.promises.mkdir(path.dirname(full), { recursive: true });
    await fs.promises.writeFile(full, body);
  }

  async getObject(key: string, range?: string): Promise<FetchedObject> {
    const full = this.resolve(key);
    const stat = await fs.promises.stat(full);

    const match = range?.match(/^bytes=(\d*)-(\d*)$/);
    if (match) {
      const start = match[1] ? parseInt(match[1], 10) : 0;
      const end = match[2] ? parseInt(match[2], 10) : stat.size - 1;
      return {
        body: fs.createReadStream(full, { start, end }),
        contentLength: end - start + 1,
        contentRange: `bytes ${start}-${end}/${stat.size}`,
        statusCode: 206,
      };
    }

    return {
      body: fs.createReadStream(full),
      contentLength: stat.size,
      statusCode: 200,
    };
  }
}

// ─── Selection ───────────────────────────────────────────────────────────────

export const localStore: ObjectStore = new LocalStore();
export const r2Store: ObjectStore = new R2Store();

export const storageDriver: StorageDriver =
  process.env.STORAGE_DRIVER === "local" ? "local" : "r2";

/** The store new uploads are written to. */
export const primaryStore: ObjectStore =
  storageDriver === "local" ? localStore : r2Store;

/** Resolves the store that actually holds an existing object. */
export const storeFor = (driver: StorageDriver): ObjectStore =>
  driver === "local" ? localStore : r2Store;

/**
 * Called once at startup so a misconfiguration crashes the process rather than
 * surfacing on a customer's first upload.
 */
export const assertStorageReady = (): void => {
  if (storageDriver === "local") {
    if (
      process.env.NODE_ENV === "production" &&
      process.env.ALLOW_LOCAL_STORAGE_IN_PROD !== "true"
    ) {
      throw new Error(
        "[Storage] STORAGE_DRIVER=local in production. Local files live inside " +
          "the container and vanish on redeploy. Set STORAGE_DRIVER=r2, or " +
          "ALLOW_LOCAL_STORAGE_IN_PROD=true if this is genuinely intended."
      );
    }
    logger.warn(
      "[Storage] Using local disk. Uploads are not durable and do not survive a redeploy."
    );
    return;
  }

  // Touch the lazy getters so missing R2 config throws here, at boot.
  requireEnv("R2_ACCOUNT_ID");
  requireEnv("R2_ACCESS_KEY_ID");
  requireEnv("R2_SECRET_ACCESS_KEY");
  requireEnv("R2_BUCKET");
};
