import { Router } from "express";
import { AuthController } from "../controller/auth.controller";
import { upload, validateUpload } from "../../../shared/middlewares/upload.middleware";
import { authenticateToken } from "../../../shared/middlewares/auth.middleware";

const router = Router();
const controller = new AuthController();

//  File Upload
router.post("/upload", upload, validateUpload, controller.uploadFile);

//  Auth
router.post("/sign-in", controller.signIn);

//  OTP Verification (must happen BEFORE registration)
router.post("/otp/send-phone", controller.sendPhoneOtp);
router.post("/otp/verify-phone", controller.verifyPhoneOtp);

//  Onboarding Steps
router.get("/me", authenticateToken, controller.getMe);
router.post("/register/step-1", controller.registerStepOne);
router.put("/register/step-2/:userId", authenticateToken, controller.registerStepTwo);
router.put("/register/step-3/:userId", authenticateToken, controller.registerStepThree);
router.post("/forgot-password", controller.forgotPassword);
router.post("/reset-password", controller.resetPassword);
router.put("/profile", authenticateToken, controller.updateProfile);
router.put("/profile/password", authenticateToken, controller.updatePassword);
router.get("/notifications", authenticateToken, controller.getNotificationSettings);
router.put("/notifications", authenticateToken, controller.updateNotificationSettings);

export const authRoutes = router;
