import { Router } from "express";
import { AdminReportsController } from "../controller/reports.controller";
import { authenticateToken, authorizeRoles } from "../../../shared/middlewares/auth.middleware";

const router = Router();
const controller = new AdminReportsController();

// Secure reports endpoint for Admin role only
router.use(authenticateToken, authorizeRoles("ADMIN"));

router.get("/", controller.getReportsList);
router.get("/:id/export", controller.exportReport);

export const reportsRoutes = router;
