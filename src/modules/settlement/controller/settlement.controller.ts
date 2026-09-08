import { Request, Response, NextFunction } from "express";
import { SettlementService } from "../service/settlement.service";
import { AppError } from "../../../shared/utils/AppError";

export class SettlementController {
  private settlementService = new SettlementService();

  approveSettlement = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const transactionId = req.params.transactionId as string;
      const adminUserId = (req as any).user?.id;
      if (!adminUserId) {
        throw new AppError("Unauthorized", 401);
      }

      const ip = req.ip || req.socket.remoteAddress;

      const transaction = await this.settlementService.approveSettlement(
        transactionId,
        adminUserId,
        ip,
      );

      res.status(200).json({
        success: true,
        message: "Settlement approved and initiated successfully",
        data: transaction,
      });
    } catch (error) {
    next(error);
  }
  };
}
