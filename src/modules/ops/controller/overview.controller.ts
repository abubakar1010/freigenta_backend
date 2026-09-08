import { Request, Response, NextFunction } from "express";
import { OpsOverviewService } from "../service/overview.service";

const overviewService = new OpsOverviewService();

export class OpsOverviewController {
  getOverview = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const data = await overviewService.getOverviewMetrics();
      res.status(200).json({
        success: true,
        data
      });
    } catch (error) {
    next(error);
  }
  };
}
