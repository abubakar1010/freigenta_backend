import { Request, Response, NextFunction } from "express";
import { ZodError } from "zod";
import { AuthService } from "../service/auth.service";
import { step1Schema, step2Schema, step3Schema, forgotPasswordSchema, resetPasswordSchema, updateProfileSchema, updatePasswordSchema } from "../auth.validation";
import { AppError } from "../../../shared/utils/AppError";
import { S3Service } from "../../../shared/services/s3.service";
import fileUpload from "express-fileupload";
import { AuthenticatedRequest } from "../../../shared/middlewares/auth.middleware";
import { User } from "../../../shared/models/user.model";

const authService = new AuthService();
const s3Service = new S3Service();

export class AuthController {
  // File Upload Controller
  uploadFile = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.files || !req.files.file) {
        throw new AppError("No file uploaded", 400);
      }

      const file = req.files.file as fileUpload.UploadedFile;
      const fileUrl = await s3Service.uploadFile(
        file.name,
        file.data,
        file.mimetype
      );

      res.status(200).json({
        success: true,
        message: "File uploaded successfully.",
        url: fileUrl,
      });
    } catch (error) {
    next(error);
  }
  };

  //  SIGN IN
  signIn = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { email, password } = req.body;
      if (!email || !password) {
        res.status(400).json({
          success: false,
          message: "Email and password are required.",
        });
        return;
      }
      const result = await authService.signIn({ email, password });
      res
        .status(200)
        .json({ success: true, message: "Login successful.", data: result });
    } catch (error) {
    next(error);
  }
  };

  // GET AUTHENTICATED USER
  getMe = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      console.log("[getMe] Request received. auth header:", req.headers["authorization"]);
      const authenticatedReq = req as AuthenticatedRequest;
      const userId = authenticatedReq.user?.userId;
      console.log("[getMe] Extracted userId:", userId);
      if (!userId) {
        throw new AppError("Unauthorized access", 401);
      }
      const user = await User.findById(userId).select("-passwordHash");
      console.log("[getMe] User found:", user?._id);
      if (!user) {
        throw new AppError("User not found", 404);
      }
      res.status(200).json({ success: true, data: user });
    } catch (error) {
    next(error);
  }
  };



  // OTP: SEND PHONE
  sendPhoneOtp = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { phone } = req.body;
      if (!phone) {
        res
          .status(400)
          .json({ success: false, message: "Phone number is required." });
        return;
      }
      await authService.sendPhoneOtp(phone);
      res.status(200).json({
        success: true,
        message: "Verification code sent to your phone.",
      });
    } catch (error) {
    next(error);
  }
  };

  // OTP: VERIFY PHONE
  verifyPhoneOtp = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { phone, code } = req.body;
      if (!phone || !code) {
        res
          .status(400)
          .json({ success: false, message: "Phone and code are required." });
        return;
      }
      await authService.verifyPhoneOtp(phone, code);
      res.status(200).json({
        success: true,
        message: "Phone number verified successfully.",
      });
    } catch (error) {
    next(error);
  }
  };

  //  STEP 1: REGISTER
  registerStepOne = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const validatedData = step1Schema.parse(req.body);
      const { user, accessToken } = await authService.createAccount(validatedData);
      res.status(201).json({
        success: true,
        message: "Account created. Proceed to Step 2: Company Information.",
        userId: user._id,
        accessToken,
      });
    } catch (error) {
    next(error);
  }
  };

  //  STEP 2: COMPANY INFO ─
  registerStepTwo = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { userId } = req.params as { userId: string };
      const authenticatedReq = req as AuthenticatedRequest;
      if (authenticatedReq.user?.userId !== userId) {
        throw new AppError("Unauthorized access to this user profile.", 403);
      }
      const validatedData = step2Schema.parse(req.body);
      const user = await authService.saveCompanyInfo(userId, validatedData);
      res.status(200).json({
        success: true,
        message:
          "Company information saved. Proceed to Step 3: Company Documents.",
        userId: user._id,
      });
    } catch (error) {
    next(error);
  }
  };

  //  STEP 3: COMPANY DOCS
  registerStepThree = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { userId } = req.params as { userId: string };
      const authenticatedReq = req as AuthenticatedRequest;
      if (authenticatedReq.user?.userId !== userId) {
        throw new AppError("Unauthorized access to this user profile.", 403);
      }
      const validatedData = step3Schema.parse(req.body);
      const user = await authService.saveCompanyDocs(userId, validatedData);
      res.status(200).json({
        success: true,
        message: "Documents saved. Onboarding complete. Pending review.",
        userId: user._id,
      });
    } catch (error) {
    next(error);
  }
  };

  // FORGOT PASSWORD
  forgotPassword = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const validatedData = forgotPasswordSchema.parse(req.body);
      await authService.requestPasswordReset(validatedData.email);
      res.status(200).json({
        success: true,
        message: "If an account with that email exists, a password reset link has been sent.",
      });
    } catch (error) {
    next(error);
  }
  };

  // RESET PASSWORD
  resetPassword = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const validatedData = resetPasswordSchema.parse(req.body);
      await authService.resetPassword(validatedData.email, validatedData.token, validatedData.password);
      res.status(200).json({
        success: true,
        message: "Password has been reset successfully. You can now log in.",
      });
    } catch (error) {
    next(error);
  }
  };

  // UPDATE PROFILE (ENTERPRISE SAAS)
  updateProfile = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const authenticatedReq = req as AuthenticatedRequest;
      const userId = authenticatedReq.user?.userId;
      if (!userId) {
        throw new AppError("Unauthorized access.", 401);
      }

      const validatedData = updateProfileSchema.parse(req.body);
      const user = await authService.updateProfile(userId, validatedData);
      
      res.status(200).json({
        success: true,
        message: "Profile updated successfully.",
        data: {
          id: user._id,
          firstName: user.firstName,
          lastName: user.lastName,
          emailAddress: user.emailAddress,
          role: user.role,
          onboardingStep: user.onboardingStep,
        },
      });
    } catch (error) {
    next(error);
  }
  };

  // UPDATE PASSWORD
  updatePassword = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const authenticatedReq = req as AuthenticatedRequest;
      const userId = authenticatedReq.user?.userId;
      if (!userId) {
        throw new AppError("Unauthorized access.", 401);
      }

      const validatedData = updatePasswordSchema.parse(req.body);
      await authService.updatePassword(userId, validatedData);
      
      res.status(200).json({
        success: true,
        message: "Password changed successfully.",
      });
    } catch (error) {
    next(error);
  }
  };

  getNotificationSettings = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const authenticatedReq = req as AuthenticatedRequest;
      const userId = authenticatedReq.user?.userId;
      if (!userId) {
        throw new AppError("Unauthorized access.", 401);
      }

      const data = await authService.getNotificationSettings(userId);
      res.status(200).json({
        success: true,
        data,
      });
    } catch (error) {
    next(error);
  }
  };

  updateNotificationSettings = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const authenticatedReq = req as AuthenticatedRequest;
      const userId = authenticatedReq.user?.userId;
      if (!userId) {
        throw new AppError("Unauthorized access.", 401);
      }

      const data = await authService.updateNotificationSettings(userId, req.body);
      res.status(200).json({
        success: true,
        message: "Notification settings updated successfully.",
        data,
      });
    } catch (error) {
    next(error);
  }
  };
}
