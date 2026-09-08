import { Router } from "express";
import { OpsKycController } from "../controller/kyc.controller";
import { authenticateToken, authorizeRoles } from "../../../shared/middlewares/auth.middleware";

const router = Router();
const controller = new OpsKycController();

// Secure KYC endpoint for Ops role (assuming "OPS" or "ADMIN" can view)
router.use(authenticateToken, authorizeRoles("OPS", "ADMIN"));

router.get("/", controller.getKycReviews);
router.get("/:id", controller.getKycDetails);
router.post("/:id/status", controller.updateKycStatus);

export const opsKycRoutes = router;
