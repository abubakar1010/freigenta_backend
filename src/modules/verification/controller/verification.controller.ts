import { Request, Response, NextFunction } from "express";
import { VerificationService } from "../service/verification.service";
import { AppError } from "../../../shared/utils/AppError";

const verificationService = new VerificationService();

export const submitVerification = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { type, number } = req.body;
    const userId = (req as any).user?.id;

    if (!userId) {
      throw new AppError("Unauthorized access attempt", 401);
    }

    const data = await verificationService.submitVerification(userId, type, number, req.ip);

    res.status(200).json({
      success: true,
      message: data.identityVerificationStatus === "VERIFIED" 
        ? "Identity verified successfully" 
        : "Identity verification failed",
      data,
    });
  } catch (error) {
    next(error);
  }
};

export const getVerificationStatus = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const userId = (req as any).user?.id;
    if (!userId) {
      throw new AppError("Unauthorized access attempt", 401);
    }

    const data = await verificationService.getVerificationStatus(userId);

    res.status(200).json({
      success: true,
      data,
    });
  } catch (error) {
    next(error);
  }
};
