import { Request, Response, NextFunction } from "express";
import { SupportService } from "../service/support.service";
import { AuthenticatedRequest } from "../../../shared/middlewares/auth.middleware";
import { AppError } from "../../../shared/utils/AppError";

export class SupportController {
  private service = new SupportService();

  getTickets = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const authenticatedReq = req as AuthenticatedRequest;
      const userId = authenticatedReq.user?.userId;
      if (!userId) throw new AppError("Unauthorized access.", 401);

      const tickets = await this.service.getTicketsForUser(userId);
      res.status(200).json({ success: true, data: tickets });
    } catch (error) {
    next(error);
  }
  };

  createTicket = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const authenticatedReq = req as AuthenticatedRequest;
      const userId = authenticatedReq.user?.userId;
      if (!userId) throw new AppError("Unauthorized access.", 401);

      const { title, message, name, initials } = req.body;
      if (!title || !message) {
        throw new AppError("Title and message are required.", 400);
      }

      const senderName = (name && name.trim()) || "Customer";
      const senderInitials = (initials && initials.trim())
        ? initials.trim().toUpperCase().substring(0, 2)
        : senderName.split(" ").filter((n: string) => n.trim().length > 0).map((n: string) => n[0]).join("").toUpperCase().substring(0, 2) || "US";

      const ticket = await this.service.createTicket(
        userId,
        title,
        message,
        senderName,
        senderInitials
      );

      res.status(201).json({ success: true, data: ticket });
    } catch (error) {
    next(error);
  }
  };

  replyToTicket = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const authenticatedReq = req as AuthenticatedRequest;
      const userId = authenticatedReq.user?.userId;
      if (!userId) throw new AppError("Unauthorized access.", 401);

      const id = req.params.id as string;
      const { message, name, initials } = req.body;

      if (!message) {
        throw new AppError("Message content is required.", 400);
      }

      const senderName = (name && name.trim()) || "Customer";
      const senderInitials = (initials && initials.trim())
        ? initials.trim().toUpperCase().substring(0, 2)
        : senderName.split(" ").filter((n: string) => n.trim().length > 0).map((n: string) => n[0]).join("").toUpperCase().substring(0, 2) || "US";

      const ticket = await this.service.replyToTicket(
        id,
        userId,
        message,
        senderName,
        senderInitials
      );

      res.status(200).json({ success: true, data: ticket });
    } catch (error) {
    next(error);
  }
  };
}
