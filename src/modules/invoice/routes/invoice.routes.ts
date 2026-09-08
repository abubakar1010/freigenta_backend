import { Router } from "express";
import {
  uploadInvoice,
  getCustomerInvoices,
  getOpsInvoices,
  correctInvoiceData,
} from "../controller/invoice.controller";
import {
  getOpsInvoiceDetail,
  getCustomerInvoiceDetail,
  addOpsInvoiceNote,
} from "../controller/opsInvoice.controller";
import {
  getCustomerActionRequired,
  submitCustomerActionResubmission,
  submitCustomerActionCancel,
} from "../controller/customerAction.controller";
import {
  authenticateToken,
  authorizeRoles,
} from "../../../shared/middlewares/auth.middleware";
import { upload, validateUpload } from "../../../shared/middlewares/upload.middleware";

/**
 * Invoice routes.
 *
 * Access control is enforced at the route level using strict role allowlists.
 * There is NO role that is allowed on both customer-scoped and ops-scoped
 * endpoints. The separation is intentional and must be maintained:
 *
 *   CUSTOMER → can only see and act on their OWN invoices.
 *   OPS / ADMIN → can see ALL invoices and perform corrections.
 *
 * Any route that serves cross-customer data (getOpsInvoices, correctInvoiceData,
 * etc.) must NEVER include CUSTOMER in its allowedRoles.
 */

const router = Router();

// All invoice endpoints require a valid access token.
router.use(authenticateToken);

// ─── Customer-scoped endpoints ─────────────────────────────────────────────
// These endpoints always filter data to the authenticated user's own records.

router.post(
  "/upload",
  authorizeRoles("CUSTOMER"),
  upload,
  validateUpload,
  uploadInvoice
);

router.get("/customer", authorizeRoles("CUSTOMER"), getCustomerInvoices);

router.get(
  "/customer/actions",
  authorizeRoles("CUSTOMER"),
  getCustomerActionRequired
);

router.get(
  "/customer/:id",
  authorizeRoles("CUSTOMER"),
  getCustomerInvoiceDetail
);

// Customer adding a note to their own invoice
router.post(
  "/customer/:id/note",
  authorizeRoles("CUSTOMER"),
  addOpsInvoiceNote  // Shared handler — ownership is enforced inside the controller
);

router.post(
  "/customer/:id/resubmit",
  authorizeRoles("CUSTOMER"),
  submitCustomerActionResubmission
);

router.post(
  "/customer/:id/cancel",
  authorizeRoles("CUSTOMER"),
  submitCustomerActionCancel
);

// ─── Operations / Admin endpoints ──────────────────────────────────────────
// These endpoints are EXCLUSIVELY for internal staff.
// CUSTOMER is intentionally NOT listed here.

router.get(
  "/ops",
  authorizeRoles("OPS", "ADMIN", "COMPLIANCE", "TREASURY"),
  getOpsInvoices
);

router.get(
  "/ops/:id",
  authorizeRoles("OPS", "ADMIN", "COMPLIANCE", "TREASURY"),
  getOpsInvoiceDetail
);

router.post(
  "/ops/:id/note",
  authorizeRoles("OPS", "ADMIN"),
  addOpsInvoiceNote
);

// Invoice data correction is a privileged write operation — OPS + ADMIN only.
router.patch(
  "/:id",
  authorizeRoles("OPS", "ADMIN"),
  correctInvoiceData
);

export const invoiceRoutes = router;
