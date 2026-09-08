import { Router } from "express";
import { OpsReportsController } from "../controller/reports.controller";
import { authenticateToken, authorizeRoles } from "../../../shared/middlewares/auth.middleware";

const router = Router();
const controller = new OpsReportsController();

// Secure Reports endpoint for Ops role
router.use(authenticateToken, authorizeRoles("OPS", "ADMIN"));

router.get("/", controller.getReportsList);
router.get("/download/:id", controller.downloadReport);

export const opsReportsRoutes = router;
