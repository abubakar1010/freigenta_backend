import { Request, Response, NextFunction } from "express";
import { CustomerService } from "../service/customer.service";
import { AuthenticatedRequest } from "../../../shared/middlewares/auth.middleware";
import { AppError } from "../../../shared/utils/AppError";

const customerService = new CustomerService();

export class CustomerController {
  // ─── Dashboard ──────────────────────────────────────────────────────────────
  getDashboardData = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const authenticatedReq = req as AuthenticatedRequest;
      const userId = authenticatedReq.user?.userId;
      if (!userId) throw new AppError("Unauthorized access.", 401);

      const { startDate, endDate } = req.query;
      const data = await customerService.getDashboardData(
        userId,
        startDate as string | undefined,
        endDate as string | undefined
      );

      res.status(200).json({ success: true, data });
    } catch (error) {
    next(error);
  }
  };

  // ─── GET /customer/payments — Paginated, searchable, filterable ─────────────
  getPayments = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const authenticatedReq = req as AuthenticatedRequest;
      const userId = authenticatedReq.user?.userId;
      if (!userId) throw new AppError("Unauthorized access.", 401);

      const page = Math.max(1, parseInt(req.query.page as string) || 1);
      const limit = Math.min(100, parseInt(req.query.limit as string) || 20);
      const search = ((req.query.search as string) || "").trim();
      const stage = ((req.query.stage as string) || "").trim().toUpperCase();
      const sortBy = (req.query.sortBy as string) || "createdAt";
      const sortOrder = req.query.sortOrder === "asc" ? 1 : -1;

      const data = await customerService.getPayments(userId, page, limit, search, stage, sortBy, sortOrder);

      res.status(200).json({
        success: true,
        data,
      });
    } catch (error) {
    next(error);
  }
  };

  // ─── GET /customer/payments/:id — Single payment detail ─────────────────────
  getPaymentById = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const authenticatedReq = req as AuthenticatedRequest;
      const userId = authenticatedReq.user?.userId;
      if (!userId) throw new AppError("Unauthorized access.", 401);

      const data = await customerService.getPaymentById(userId, req.params.id as string);

      res.status(200).json({
        success: true,
        data,
      });
    } catch (error) {
    next(error);
  }
  };

  // ─── GET /customer/currencies — Server side API proxy to resolve CORS ────────
  getCurrencies = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const data = await customerService.getCurrencies();
      res.status(200).json({
        success: true,
        data,
      });
    } catch (error) {
    next(error);
  }
  };

  // ─── GET /customer/reports — Dynamic reports list and aggregated metrics ──────
  getReportsData = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const authenticatedReq = req as AuthenticatedRequest;
      const userId = authenticatedReq.user?.userId;
      if (!userId) throw new AppError("Unauthorized access.", 401);

      const data = await customerService.getReportsData(userId);

      res.status(200).json({
        success: true,
        data,
      });
    } catch (error) {
    next(error);
  }
  };

  // ─── GET /customer/reports/:id/export — Dynamic CSV exporter ───────────────
  exportReportCsv = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const authenticatedReq = req as AuthenticatedRequest;
      const userId = authenticatedReq.user?.userId;
      if (!userId) throw new AppError("Unauthorized access.", 401);

      const id = req.params.id as string;
      const csvContent = await customerService.exportReportCsv(userId, id);

      res.setHeader("Content-Type", "text/csv");
      res.setHeader(
        "Content-Disposition",
        `attachment; filename=report-${id}-${Date.now()}.csv`,
      );
      res.status(200).send(csvContent);
    } catch (error) {
    next(error);
  }
  };

  // ─── Payment Methods ────────────────────────────────────────────────────────
  getPaymentMethods = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const authenticatedReq = req as AuthenticatedRequest;
      const userId = authenticatedReq.user?.userId;
      if (!userId) throw new AppError("Unauthorized access.", 401);

      const data = await customerService.getPaymentMethods(userId);
      res.status(200).json({ success: true, data });
    } catch (error) {
    next(error);
  }
  };

  addPaymentMethod = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const authenticatedReq = req as AuthenticatedRequest;
      const userId = authenticatedReq.user?.userId;
      if (!userId) throw new AppError("Unauthorized access.", 401);

      const data = await customerService.addPaymentMethod(userId, req.body);
      res.status(201).json({ success: true, data });
    } catch (error) {
    next(error);
  }
  };

  deletePaymentMethod = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const authenticatedReq = req as AuthenticatedRequest;
      const userId = authenticatedReq.user?.userId;
      if (!userId) throw new AppError("Unauthorized access.", 401);

      const id = req.params.id as string;
      await customerService.deletePaymentMethod(userId, id);

      res.status(200).json({
        success: true,
        message: "Payment method deleted successfully.",
      });
    } catch (error) {
    next(error);
  }
  };
}
