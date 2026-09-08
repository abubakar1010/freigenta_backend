import { Router } from "express";
import { OpsSettlementsController } from "../controller/settlements.controller";
import { authenticateToken, authorizeRoles } from "../../../shared/middlewares/auth.middleware";

const router = Router();
const controller = new OpsSettlementsController();

// Secure settlements endpoint for Ops role only (assuming "OPS" or "ADMIN" can view)
router.use(authenticateToken, authorizeRoles("OPS", "ADMIN"));

router.get("/", controller.getSettlements);
router.post("/:id/status", controller.updateSettlementStatus);

export const opsSettlementsRoutes = router;
