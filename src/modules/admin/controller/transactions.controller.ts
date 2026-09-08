import { Request, Response, NextFunction } from "express";
import { AdminTransactionsService } from "../service/transactions.service";

const transactionsService = new AdminTransactionsService();

export class AdminTransactionsController {
  getTransactions = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const page = Math.max(1, parseInt(req.query.page as string) || 1);
      const limit = Math.max(1, parseInt(req.query.limit as string) || 10);
      const statusFilter = (req.query.status as string || "All").trim();
      const searchQuery = (req.query.search as string || "").trim();

      const data = await transactionsService.getTransactions({
        page,
        limit,
        statusFilter,
        searchQuery
      });

      res.status(200).json({
        success: true,
        data: data.transactions,
        pagination: data.pagination
      });
    } catch (error) {
    next(error);
  }
  };
}
