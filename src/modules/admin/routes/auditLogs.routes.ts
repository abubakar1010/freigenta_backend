import { Router } from "express";
import { AdminAuditLogsController } from "../controller/auditLogs.controller";
import { authenticateToken, authorizeRoles } from "../../../shared/middlewares/auth.middleware";

const router = Router();
const controller = new AdminAuditLogsController();

// Secure audit log routes for Admin role only
router.use(authenticateToken, authorizeRoles("ADMIN"));

router.get("/", controller.getAuditLogs);

export const auditLogsRoutes = router;
