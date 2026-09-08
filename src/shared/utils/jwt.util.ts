import jwt, { SignOptions } from "jsonwebtoken";
import { logger } from "./logger";

/**
 * JWT utility.
 *
 * JWT_SECRET is mandatory. The process crashes at startup if it is missing,
 * rather than silently using a weak fallback that would be exploitable in
 * production.
 *
 * Tokens expire after JWT_EXPIRES_IN (default: 15 minutes). Paired with a
 * refresh token strategy this keeps the attack window for compromised tokens
 * minimal.
 */

function requireEnv(key: string): string {
  const value = process.env[key];
  if (!value) {
    throw new Error(
      `[JWT] Missing required environment variable: ${key}. ` +
        "Generate a 256-bit secret: openssl rand -base64 32"
    );
  }
  return value;
}

// Lazily evaluated so tests can set process.env before importing
let _secret: string | null = null;
function getSecret(): string {
  if (!_secret) _secret = requireEnv("JWT_SECRET");
  return _secret;
}

export const generateToken = (payload: object): string => {
  const options: SignOptions = {
    expiresIn: (process.env.JWT_EXPIRES_IN as SignOptions["expiresIn"]) ?? "15m",
  };
  return jwt.sign(payload, getSecret(), options);
};

export const verifyToken = (token: string): any => {
  try {
    return jwt.verify(token, getSecret());
  } catch (error: any) {
    logger.warn({ err: error.message }, "[JWT] Token verification failed");
    throw new Error("Invalid or expired token");
  }
};
