import { Response, NextFunction } from "express";
import { StoredFile, IStoredFile } from "../../../shared/models/storedFile.model";
import { storeFor } from "../../../shared/services/storage.service";
import { canAccess } from "../../../shared/services/file.service";
import { authenticateToken, AuthenticatedRequest } from "../../../shared/middlewares/auth.middleware";
import { AppError } from "../../../shared/utils/AppError";
import { logAudit } from "../../../shared/utils/audit";
import { logger } from "../../../shared/utils/logger";

/**
 * The single read path for uploaded objects.
 *
 * Bytes are streamed through the app rather than handing the client a
 * presigned R2 URL. A presigned URL for a passport scan is a bearer credential
 * in a query string — it would end up in browser history, Referer headers and
 * nginx access logs, and cannot be revoked once issued. Proxying also keeps
 * responses on our own origin, so the existing CORS policy covers them and no
 * bucket-side CORS configuration is needed.
 *
 * If bandwidth ever becomes the constraint, swapping serveFile for a 302 to a
 * short-lived presigned URL is a contained change — but R2 CORS becomes
 * mandatory at that point.
 */

interface FileRequest extends AuthenticatedRequest {
  storedFile?: IStoredFile;
}

/** Express 5 returns wildcard params as an array of path segments. */
const keyFromParams = (params: any): string => {
  const splat = params?.splat;
  if (Array.isArray(splat)) return splat.join("/");
  return String(splat ?? "");
};

export const loadFile = async (
  req: FileRequest,
  _res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const key = keyFromParams(req.params);
    if (!key) throw new AppError("File not found", 404);

    const file = await StoredFile.findOne({ key });
    if (!file) throw new AppError("File not found", 404);

    req.storedFile = file;
    next();
  } catch (error) {
    next(error);
  }
};

/**
 * Public objects (news and settings images) must stay readable by a logged-out
 * browser — an <img> tag cannot send an Authorization header. Everything else
 * requires a token.
 */
export const authenticateIfPrivate = (
  req: FileRequest,
  res: Response,
  next: NextFunction
): void => {
  if (req.storedFile?.visibility === "PUBLIC") {
    next();
    return;
  }
  authenticateToken(req, res, next);
};

export const authorizeFile = (
  req: FileRequest,
  _res: Response,
  next: NextFunction
): void => {
  const file = req.storedFile!;
  if (!canAccess(file, req.user)) {
    logger.warn(
      { key: file.key, userId: req.user?.userId, role: req.user?.role },
      "[Files] Denied access to a file the caller does not own"
    );
    next(new AppError("You do not have access to this file", 403));
    return;
  }
  next();
};

export const serveFile = async (
  req: FileRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  const file = req.storedFile!;

  try {
    const store = storeFor(file.storage);
    const range = req.headers.range;
    const object = await store.getObject(file.key, range);

    // Always the sniffed type from upload, never anything client-supplied.
    res.setHeader("Content-Type", file.contentType);
    res.setHeader("X-Content-Type-Options", "nosniff");

    // Render images inline so <img> works; force everything else to download
    // rather than execute in the origin's context.
    const inline = file.contentType === "image/jpeg" || file.contentType === "image/png";
    res.setHeader(
      "Content-Disposition",
      `${inline ? "inline" : "attachment"}; filename="${file.originalName}"`
    );

    res.setHeader(
      "Cache-Control",
      file.visibility === "PUBLIC"
        ? "public, max-age=86400"
        : "private, no-store"
    );

    if (object.contentLength !== undefined) {
      res.setHeader("Content-Length", String(object.contentLength));
    }
    if (object.contentRange) {
      res.setHeader("Content-Range", object.contentRange);
      res.setHeader("Accept-Ranges", "bytes");
    }

    res.status(object.statusCode);

    if (file.visibility === "PRIVATE" && req.user) {
      // Fire-and-forget; a regulated business will eventually be asked who
      // viewed a given identity document.
      void logAudit(
        req.user.userId,
        "FILE_VIEWED",
        String(file._id),
        undefined,
        { key: file.key, purpose: file.purpose },
        req.ip
      );
    }

    object.body.on("error", (err) => {
      logger.error({ err, key: file.key }, "[Files] Stream failed mid-response");
      res.destroy();
    });

    object.body.pipe(res);
  } catch (error: any) {
    logger.error(
      { err: error.message, key: file.key, storage: file.storage },
      "[Files] Failed to read object from storage"
    );
    next(new AppError("Failed to retrieve file", 502));
  }
};
