import { Router } from "express";
import { AdminOverviewController } from "../controller/overview.controller";
import { authenticateToken, authorizeRoles } from "../../../shared/middlewares/auth.middleware";

const router = Router();
const controller = new AdminOverviewController();

// Protect all overview endpoints with Admin check
router.use(authenticateToken, authorizeRoles("ADMIN"));

router.get("/", controller.getOverviewData);

export const overviewRoutes = router;
