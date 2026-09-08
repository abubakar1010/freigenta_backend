import { Response, NextFunction } from "express";
import { verifyToken, generateScopedToken } from "../utils/jwt.util";
import { AppError } from "../utils/AppError";
import { AuthenticatedRequest } from "./auth.middleware";
import { logger } from "../utils/logger";

/**
 * Authentication for POST /auth/upload.
 *
 * The endpoint has to serve two callers that cannot both hold a session:
 *
 *  - a registering customer, who must upload an identity document and proof of
 *    address BEFORE the account exists (step1Schema requires both URLs in the
 *    registration body), and
 *  - a signed-in user or admin uploading a profile picture, news image or
 *    settings image.
 *
 * Both arrive as `Authorization: Bearer <token>`; the payload says which. The
 * onboarding ticket is minted only after an SMS OTP has been verified, so an
 * anonymous caller can no longer write objects into the bucket.
 *
 * This is a bridge, not the destination. The clean fix is to reorder
 * registration so the account exists first and documents upload against a real
 * session — at which point the ticket path can be deleted.
 */

export const UPLOAD_TICKET_PURPOSE = "onboarding-upload";
const TICKET_TTL = "15m";

export interface UploadRequest extends AuthenticatedRequest {
  uploadTicket?: { phone: string };
}

/** Issued by verifyPhoneOtp once the code checks out. */
export const issueUploadTicket = (phone: string): string =>
  generateScopedToken(
    { purpose: UPLOAD_TICKET_PURPOSE, phone: phone.toLowerCase() },
    TICKET_TTL
  );

export const requireUploadCredential = (
  req: UploadRequest,
  _res: Response,
  next: NextFunction
): void => {
  const header = req.headers["authorization"];
  const token =
    header && header.startsWith("Bearer ") ? header.slice(7) : undefined;

  if (!token) {
    next(
      new AppError(
        "Uploads require either a signed-in session or a verified-phone upload ticket.",
        401
      )
    );
    return;
  }

  let payload: any;
  try {
    payload = verifyToken(token);
  } catch {
    next(new AppError("Invalid or expired upload credential", 401));
    return;
  }

  if (payload?.purpose === UPLOAD_TICKET_PURPOSE) {
    if (!payload.phone) {
      next(new AppError("Malformed upload ticket", 401));
      return;
    }
    req.uploadTicket = { phone: String(payload.phone).toLowerCase() };
    next();
    return;
  }

  if (payload?.userId) {
    req.user = payload;
    next();
    return;
  }

  logger.warn("[Upload] Bearer token matched neither a session nor a ticket");
  next(new AppError("Invalid upload credential", 401));
};
