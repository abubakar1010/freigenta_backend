import { Request, Response, NextFunction } from "express";
import { AdminOverviewService } from "../service/overview.service";

const overviewService = new AdminOverviewService();

export class AdminOverviewController {
  getOverviewData = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const search = (req.query.search as string || "").trim();
      const data = await overviewService.getOverviewData(search);

      res.status(200).json({
        success: true,
        data,
      });
    } catch (error) {
    next(error);
  }
  };
}
