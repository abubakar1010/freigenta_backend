import { Request, Response, NextFunction } from "express";
import { AdminAuditLogsService } from "../service/auditLogs.service";

const auditLogsService = new AdminAuditLogsService();

export class AdminAuditLogsController {
  getAuditLogs = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const page = Math.max(1, parseInt(req.query.page as string) || 1);
      const limit = Math.max(1, parseInt(req.query.limit as string) || 10);

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
