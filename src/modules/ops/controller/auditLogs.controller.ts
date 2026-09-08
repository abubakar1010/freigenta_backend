import { Request, Response, NextFunction } from "express";
import { OpsAuditLogsService } from "../service/auditLogs.service";

const auditLogsService = new OpsAuditLogsService();

export class OpsAuditLogsController {
  getAuditLogs = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 10;

      const data = await auditLogsService.getAuditLogs({ page, limit });

      res.status(200).json({
        success: true,
        data: data.logs,
        pagination: data.pagination
      });
    } catch (error) {
    next(error);
  }
  };
}
