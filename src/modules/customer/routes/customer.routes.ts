import { Router } from "express";
import { CustomerController } from "../controller/customer.controller";
import { authenticateToken } from "../../../shared/middlewares/auth.middleware";

const router = Router();
const controller = new CustomerController();

// Dashboard overview
router.get("/dashboard",      authenticateToken, controller.getDashboardData);

// Payments list — GET /customer/payments?page=1&limit=20&search=INV&stage=VERIFICATION&sortBy=createdAt&sortOrder=desc
router.get("/payments",       authenticateToken, controller.getPayments);

// Single payment detail — GET /customer/payments/:id
router.get("/payments/:id",   authenticateToken, controller.getPaymentById);

// Dynamic currencies — GET /customer/currencies
router.get("/currencies",     authenticateToken, controller.getCurrencies);

// Customer reports list and metrics — GET /customer/reports
router.get("/reports",        authenticateToken, controller.getReportsData);

// Export report as CSV — GET /customer/reports/:id/export
router.get("/reports/:id/export", authenticateToken, controller.exportReportCsv);

// Payment Methods
router.get("/payment-methods", authenticateToken, controller.getPaymentMethods);
router.post("/payment-methods", authenticateToken, controller.addPaymentMethod);
router.delete("/payment-methods/:id", authenticateToken, controller.deletePaymentMethod);

export const customerRoutes = router;
