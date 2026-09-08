import { Request, Response, NextFunction } from "express";
import { OpsKycService } from "../service/kyc.service";

const kycService = new OpsKycService();

export class OpsKycController {
  getKycReviews = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 10;

      const data = await kycService.getKycReviews({ page, limit });

      res.status(200).json({
        success: true,
        data: data.records,
        attentionCount: data.attentionCount,
        pagination: data.pagination
      });
    } catch (error) {
    next(error);
  }
  };

  getKycDetails = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const id = req.params.id as string;
      const data = await kycService.getKycDetails(id);

      res.status(200).json({
        success: true,
        data
      });
    } catch (error) {
    next(error);
  }
  };

  updateKycStatus = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const id = req.params.id as string;
      const { action } = req.body as { action: "approve" | "reject" | "request-info" };

      if (!action || !["approve", "reject", "request-info"].includes(action)) {
        res.status(400).json({
          success: false,
          message: "Action must be 'approve', 'reject', or 'request-info'."
        });
        return;
      }

      const updatedRecord = await kycService.updateKycStatus(id, action);

      res.status(200).json({
        success: true,
        message: `KYC action '${action}' processed successfully.`,
        data: updatedRecord
      });
    } catch (error) {
    next(error);
  }
  };
}
