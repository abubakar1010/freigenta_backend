import { Router } from "express";
import { OpsOverviewController } from "../controller/overview.controller";
import { authenticateToken, authorizeRoles } from "../../../shared/middlewares/auth.middleware";

const router = Router();
const controller = new OpsOverviewController();

// Guard overview routes for staff and customer access during testing
router.use(authenticateToken, authorizeRoles("ADMIN", "OPS", "COMPLIANCE", "TREASURY", "CUSTOMER"));

router.get("/", controller.getOverview);

export const opsOverviewRoutes = router;
