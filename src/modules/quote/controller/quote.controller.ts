import { Request, Response, NextFunction } from "express";
import { QuoteService } from "../service/quote.service";

const quoteService = new QuoteService();

export const generateQuote = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { invoiceId } = req.body;
    const opsUserId = (req as any).user?.id;

    const quote = await quoteService.generateQuote(invoiceId, opsUserId, req.ip);

    res.status(201).json({
      success: true,
      message: "Quote generated and sent to customer successfully",
      data: quote,
    });
  } catch (error) {
    next(error);
  }
};

export const respondToQuote = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const id = req.params.id as string;
    const { action } = req.body; // 'ACCEPT' or 'DECLINE'
    const userId = (req as any).user?.id;

    const data = await quoteService.respondToQuote(id, action, userId, req.ip);

    res.status(200).json({
      success: true,
      message: action === "ACCEPT" 
        ? "Quote accepted successfully and transaction initialized"
        : "Quote declined successfully",
      data: action === "ACCEPT" ? data.quote : data.quote,
      // For backwards compatibility response format in accept case:
      ...(action === "ACCEPT" && { transaction: (data as any).transaction })
    });
  } catch (error) {
    next(error);
  }
};

export const getCustomerQuotes = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const userId = (req as any).user?.id;
    const data = await quoteService.getCustomerQuotes(userId);

    res.status(200).json({
      success: true,
      data,
    });
  } catch (error) {
    next(error);
  }
};

export const getOpsQuotes = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const data = await quoteService.getOpsQuotes();

    res.status(200).json({
      success: true,
      data,
    });
  } catch (error) {
    next(error);
  }
};
