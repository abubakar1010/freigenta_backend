import { Router } from "express";
import { OpsAuditLogsController } from "../controller/auditLogs.controller";
import { authenticateToken, authorizeRoles } from "../../../shared/middlewares/auth.middleware";

const router = Router();
const controller = new OpsAuditLogsController();

// Secure Audit Logs endpoint for Ops role (assuming "OPS" or "ADMIN" can view)
router.use(authenticateToken, authorizeRoles("OPS", "ADMIN"));

router.get("/", controller.getAuditLogs);

export const opsAuditLogsRoutes = router;
