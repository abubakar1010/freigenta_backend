import { Router } from "express";
import { submitVerification, getVerificationStatus } from "../controller/verification.controller";
import { authenticateToken } from "../../../shared/middlewares/auth.middleware";

const router = Router();

router.use(authenticateToken);

router.post("/submit", submitVerification);
router.get("/status", getVerificationStatus);

export const verificationRoutes = router;
