import { Router } from "express";
import { AdminKycController } from "../controller/kyc.controller";
import { authenticateToken, authorizeRoles } from "../../../shared/middlewares/auth.middleware";

const router = Router();
const controller = new AdminKycController();

// Secure KYC review routes for Admin role only
router.use(authenticateToken, authorizeRoles("ADMIN"));

router.get("/", controller.getKycReviews);
router.get("/:id", controller.getKycDetails);
router.post("/:id/status", controller.updateKycStatus);

export const kycRoutes = router;
