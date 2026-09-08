import { Router } from "express";
import { SettlementController } from "../controller/settlement.controller";
// Assuming authMiddleware and roleMiddleware exist in the shared folder
// import { authMiddleware, roleMiddleware } from "../../../shared/middlewares/auth.middleware";

const router = Router();
const settlementController = new SettlementController();

// Treasury or Admin approval route
// In a real app, protect this with authMiddleware and roleMiddleware(["TREASURY", "ADMIN"])
router.post(
    "/:transactionId/approve",
    // authMiddleware,
    // roleMiddleware(["TREASURY", "ADMIN"]),
    settlementController.approveSettlement
);

export default router;
