import { Request, Response, NextFunction } from "express";
import { AdminReportsService } from "../service/reports.service";

const reportsService = new AdminReportsService();

export class AdminReportsController {
  getReportsList = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const list = await reportsService.getReportsList();
      res.status(200).json({
        success: true,
        data: list
      });
    } catch (error) {
    next(error);
  }
  };

  exportReport = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const id = req.params.id as string;
      const { filename, csv } = await reportsService.generateReportCsv(id);

      // Set headers for file download
      res.setHeader("Content-Type", "text/csv");
      res.setHeader("Content-Disposition", `attachment; filename=${filename}`);
      res.status(200).send(csv);
    } catch (error) {
    next(error);
  }
  };
}
