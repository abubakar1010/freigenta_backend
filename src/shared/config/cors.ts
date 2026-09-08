import type { CorsOptions } from "cors";
import { logger } from "../utils/logger";

/**
 * Single source of truth for cross-origin policy.
 *
 * Both the HTTP API (server.ts) and the Socket.io server (socket.service.ts)
 * use this delegate, so a websocket cannot bypass the allowlist that HTTP
 * requests are held to.
 *
 * An empty ALLOWED_ORIGINS is permissive in development and fails closed in
 * production — a deployment that forgets the variable rejects browsers rather
 * than silently accepting every origin.
 *
 * Read at module load, which is after dotenv.config() runs in app.ts.
 */
export const allowedOrigins = (process.env.ALLOWED_ORIGINS || "")
  .split(",")
  .map((o) => o.trim())
  .filter(Boolean);

export const corsOrigin: CorsOptions["origin"] = (origin, callback) => {
  // Allow requests with no origin (server-to-server, curl, Postman in dev)
  if (!origin) return callback(null, true);

  if (allowedOrigins.length === 0) {
    if (process.env.NODE_ENV !== "production") return callback(null, true);
    return callback(new Error("CORS: no allowed origins configured"));
  }

  if (allowedOrigins.includes(origin)) return callback(null, true);

  logger.warn({ origin }, "[CORS] Rejected request from unlisted origin");
  return callback(new Error(`CORS: origin ${origin} not allowed`));
};
