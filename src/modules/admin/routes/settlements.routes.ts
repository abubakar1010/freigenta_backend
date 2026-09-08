import { Router } from "express";
import { AdminSettlementsController } from "../controller/settlements.controller";
import { authenticateToken, authorizeRoles } from "../../../shared/middlewares/auth.middleware";

const router = Router();
const controller = new AdminSettlementsController();

// Secure settlements endpoint for Admin role only
router.use(authenticateToken, authorizeRoles("ADMIN"));

router.get("/", controller.getSettlements);
router.post("/:id/status", controller.updateSettlementStatus);

export const settlementsRoutes = router;
