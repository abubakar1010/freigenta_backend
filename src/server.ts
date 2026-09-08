import express from "express";
import cors from "cors";
import helmet from "helmet";
import pinoHttp from "pino-http";
import { logger } from "./shared/utils/logger";
import { corsOrigin } from "./shared/config/cors";
import { globalRateLimiter, webhookRateLimiter, authRateLimiter } from "./shared/middlewares/rateLimiter";
import { errorHandler } from "./shared/middlewares/errorHandler";

// ─── Route imports ────────────────────────────────────────────────────────────
import { authRoutes } from "./modules/auth/routes/auth.routes";
import { settingsRoutes } from "./modules/admin/routes/settings.routes";
import { verificationRoutes } from "./modules/verification/routes/verification.routes";
import { invoiceRoutes } from "./modules/invoice/routes/invoice.routes";
import { quoteRoutes } from "./modules/quote/routes/quote.routes";
import { customerRoutes } from "./modules/customer/routes/customer.routes";
import { supportRoutes } from "./modules/support/routes/support.routes";
import { overviewRoutes } from "./modules/admin/routes/overview.routes";
import { usersRoutes } from "./modules/admin/routes/users.routes";
import { transactionsRoutes } from "./modules/admin/routes/transactions.routes";
import { settlementsRoutes } from "./modules/admin/routes/settlements.routes";
import { kycRoutes } from "./modules/admin/routes/kyc.routes";
import { reportsRoutes } from "./modules/admin/routes/reports.routes";
import { auditLogsRoutes } from "./modules/admin/routes/auditLogs.routes";
import { adminSupportRoutes } from "./modules/admin/routes/support.routes";
import { faqRoutes } from "./modules/faq/routes/faq.routes";
import { careerRoutes } from "./modules/careers/routes/careers.routes";
import { newsRoutes } from "./modules/news/routes/news.routes";
import { contactRoutes } from "./modules/contact/routes/contact.routes";
import { bankRoutes } from "./modules/admin/routes/bank.routes";
import { opsOverviewRoutes } from "./modules/ops/routes/overview.routes";
import { opsSettlementsRoutes } from "./modules/ops/routes/settlements.routes";
import { opsKycRoutes } from "./modules/ops/routes/kyc.routes";
import { opsReportsRoutes } from "./modules/ops/routes/reports.routes";
import { opsAuditLogsRoutes } from "./modules/ops/routes/auditLogs.routes";
import { webhookRoutes } from "./modules/webhooks/routes/webhook.routes";
import { fileRoutes } from "./modules/files/routes/files.routes";

// ─── CORS configuration ───────────────────────────────────────────────────────
// Origin policy lives in shared/config/cors so the Socket.io server enforces
// the same allowlist.
const corsOptions: cors.CorsOptions = {
  origin: corsOrigin,
  credentials: true,
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
};

// ─── App bootstrap ────────────────────────────────────────────────────────────
const app = express();

// Trust proxy — required for correct `req.ip` behind nginx / load balancers
app.set("trust proxy", 1);

// HTTP request logging (structured JSON in prod, pretty in dev)
app.use(pinoHttp({ logger }));

// Security headers — MUST come before route handlers
app.use(
  helmet({
    // Allow cross-origin embedding of our uploaded assets (S3 / local)
    crossOriginResourcePolicy: { policy: "cross-origin" },
    contentSecurityPolicy: process.env.NODE_ENV === "production",
  })
);

// CORS
app.use(cors(corsOptions));
// Pre-flight. Express 5 routes through path-to-regexp v8, where a bare "*" is
// a parse error — the catch-all is spelled "/{*splat}" (zero or more segments,
// so it covers "/" too).
app.options("/{*splat}", cors(corsOptions));

// Global rate limit — applied to every request before routing
app.use(globalRateLimiter);

// Raw body capture for webhook signature verification.
// Must be registered BEFORE express.json() so that the raw buffer is
// available at req.rawBody by the time webhook handlers run.
app.use(
  express.json({
    verify: (req: any, _res, buf) => {
      req.rawBody = buf;
    },
  })
);

// NOTE: /uploads static serving was removed deliberately. It exposed the local
// storage directory — which holds KYC and customs documents when the fallback
// fires — over an unauthenticated path, bypassing every access check. All
// reads now go through /api/files, which authorises per object.

// ─── Health check ─────────────────────────────────────────────────────────────
app.get("/health", (_req, res) => res.json({ status: "ok" }));

// ─── Route mounting ───────────────────────────────────────────────────────────
// Auth routes get a stricter per-IP rate limit
app.use("/api/auth", authRateLimiter, authRoutes);

// Webhook routes get their own limiter (higher volume, time-sensitive)
app.use("/api/webhooks", webhookRateLimiter, webhookRoutes);

// Uploaded objects. Authorisation is per file and lives in the route itself,
// because public marketing images must stay readable without a token.
app.use("/api/files", fileRoutes);

// Admin portals
app.use("/api/admin/settings", settingsRoutes);
app.use("/api/admin/overview", overviewRoutes);
app.use("/api/admin/users", usersRoutes);
app.use("/api/admin/transactions", transactionsRoutes);
app.use("/api/admin/settlements", settlementsRoutes);
app.use("/api/admin/kyc-reviews", kycRoutes);
app.use("/api/admin/reports", reportsRoutes);
app.use("/api/admin/audit-logs", auditLogsRoutes);
app.use("/api/admin/support", adminSupportRoutes);
app.use("/api/admin/banks", bankRoutes);

// Ops portals
app.use("/api/ops/overview", opsOverviewRoutes);
app.use("/api/ops/settlements", opsSettlementsRoutes);
app.use("/api/ops/kyc-reviews", opsKycRoutes);
app.use("/api/ops/reports", opsReportsRoutes);
app.use("/api/ops/audit-logs", opsAuditLogsRoutes);

// Customer-facing
app.use("/api/verification", verificationRoutes);
app.use("/api/invoices", invoiceRoutes);
app.use("/api/quotes", quoteRoutes);
app.use("/api/customer", customerRoutes);
app.use("/api/support", supportRoutes);

// Public / marketing
app.use("/api/faq", faqRoutes);
app.use("/api/careers", careerRoutes);
app.use("/api/news", newsRoutes);
app.use("/api/contact", contactRoutes);

// ─── Global error handler (must be last) ─────────────────────────────────────
app.use(errorHandler);

export default app;
