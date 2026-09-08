import { Request, Response, NextFunction } from "express";
import { OpsReportsService } from "../service/reports.service";

const reportsService = new OpsReportsService();

export class OpsReportsController {
  getReportsList = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const data = await reportsService.getReportsList();

      res.status(200).json({
        success: true,
        data,
      });
    } catch (error) {
    next(error);
  }
  };

  downloadReport = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const id = req.params.id as string;
      const { filename, csv } = await reportsService.generateReportCsv(id);

      res.setHeader("Content-Type", "text/csv");
      res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
      res.status(200).send(csv);
    } catch (error) {
    next(error);
  }
  };
}
