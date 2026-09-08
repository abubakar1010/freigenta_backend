import { Request, Response, NextFunction } from "express";
import { verifyToken } from "../utils/jwt.util";
import { AppError } from "../utils/AppError";
import { logger } from "../utils/logger";

export interface AuthenticatedRequest extends Request {
  user?: {
    userId: string;
    role: string;
  };
}

/**
 * Verifies the JWT access token and attaches the decoded payload to `req.user`.
 * Supports Bearer token in Authorization header and a `?token=` query parameter
 * (the latter is needed for direct browser downloads / CSV exports where custom
 * headers cannot be set).
 */
export const authenticateToken = (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): void => {
  const authHeader = req.headers["authorization"];
  let token = authHeader && authHeader.startsWith("Bearer ")
    ? authHeader.slice(7)
    : undefined;

  // Fallback to query param token — only for GET requests to prevent misuse
  if (!token && req.query.token && req.method === "GET") {
    token = req.query.token as string;
  }

  if (!token) {
    next(new AppError("Access token is required", 401));
    return;
  }

  try {
    const decoded = verifyToken(token);
    req.user = decoded;
    next();
  } catch (error: any) {
    logger.warn({ err: error.message }, "[Auth] Invalid or expired access token");
    next(new AppError("Invalid or expired access token", 401));
  }
};

/**
 * Role-based access control guard.
 *
 * Checks that `req.user.role` is explicitly listed in the `allowedRoles`
 * array. There is NO implicit super-role bypass — every privileged endpoint
 * must declare exactly which roles may access it.
 *
 * Usage:
 *   router.use(authenticateToken, authorizeRoles("ADMIN", "OPS"));
 */
export const authorizeRoles = (...allowedRoles: string[]) => {
  const normalized = allowedRoles.map((r) => r.toUpperCase());

  return (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): void => {
    if (!req.user) {
      next(new AppError("Unauthorized: no authenticated session", 401));
      return;
    }

    const userRole = (req.user.role || "").toUpperCase();

    if (!normalized.includes(userRole)) {
      logger.warn(
        { userId: req.user.userId, role: userRole, required: normalized },
        "[Auth] Forbidden: insufficient role"
      );
      next(new AppError("Forbidden: insufficient permissions", 403));
      return;
    }

    next();
  };
};
