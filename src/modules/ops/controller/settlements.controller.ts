import { Request, Response, NextFunction } from "express";
import { OpsSettlementsService } from "../service/settlements.service";

const settlementsService = new OpsSettlementsService();

export class OpsSettlementsController {
  getSettlements = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const statusFilter = (req.query.status as string || "All Settlements").trim();
      const dateFilter = req.query.date as string | undefined;
      const data = await settlementsService.getSettlements(statusFilter, dateFilter);

      res.status(200).json({
        success: true,
        data: data.settlements,
        metrics: data.metrics
      });
    } catch (error) {
    next(error);
  }
  };

  updateSettlementStatus = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const id = req.params.id as string;
      const { action } = req.body as { action: "start" | "complete" };

      if (!action || !["start", "complete"].includes(action)) {
        res.status(400).json({
          success: false,
          message: "Action query parameter must be 'start' or 'complete'."
        });
        return;
      }

      const updatedSettlement = await settlementsService.updateSettlementStatus(id, action);

      res.status(200).json({
        success: true,
        message: `Settlement action '${action}' processed successfully.`,
        data: updatedSettlement
      });
    } catch (error) {
    next(error);
  }
  };
}
