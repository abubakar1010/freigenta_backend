import rateLimit, { ipKeyGenerator } from "express-rate-limit";
import { Request, Response } from "express";
import { logger } from "../utils/logger";

/**
 * Standard JSON response for rate-limited requests (HTTP 429).
 */
const rateLimitHandler = (req: Request, res: Response) => {
  logger.warn(
    { ip: req.ip, path: req.path },
    "[RateLimit] Request rejected — limit exceeded"
  );
  res.status(429).json({
    success: false,
    message: "Too many requests. Please try again later.",
  });
};

/**
 * Normalizes the request IP for rate limiting.
 * Uses express-rate-limit's ipKeyGenerator to correctly collapse
 * IPv6 addresses into a /56 subnet, preventing per-address bypass.
 */
const keyGenerator = (req: Request): string =>
  ipKeyGenerator(req.ip ?? "unknown");

/**
 * Strict limiter for auth endpoints (login, OTP, password reset).
 * 10 attempts per 15 minutes per IP.
 */
export const authRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1_000,
  max: 10,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  handler: rateLimitHandler,
  keyGenerator,
  skipSuccessfulRequests: false,
});

/**
 * Uploads get their own budget. They sit under /api/auth, so without this a
 * customer submitting five onboarding documents would burn half of the
 * authRateLimiter allowance for their IP — and an office NAT shares that IP
 * across everyone in the building.
 * 30 uploads per 15 minutes per IP.
 */
export const uploadRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1_000,
  max: 30,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  handler: rateLimitHandler,
  keyGenerator,
});

/**
 * Global API limiter — applied to all routes by default.
 * 300 requests per minute per IP.
 */
export const globalRateLimiter = rateLimit({
  windowMs: 60 * 1_000,
  max: 300,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  handler: rateLimitHandler,
  keyGenerator,
  skip: (req) => req.path === "/health" || req.path === "/ping",
});

/**
 * Webhook limiter — accommodates provider burst traffic.
 * 200 requests per minute per IP.
 */
export const webhookRateLimiter = rateLimit({
  windowMs: 60 * 1_000,
  max: 200,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  handler: rateLimitHandler,
  keyGenerator,
});
