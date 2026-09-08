import { Request, Response, NextFunction } from "express";
import { AdminSupportService } from "../service/support.service";
import { AuthenticatedRequest } from "../../../shared/middlewares/auth.middleware";

const supportService = new AdminSupportService();

export class AdminSupportController {
  getAllTickets = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const tickets = await supportService.getAllTickets();
      res.status(200).json({
        success: true,
        data: tickets,
      });
    } catch (error) {
    next(error);
  }
  };

  replyToTicket = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const authenticatedReq = req as AuthenticatedRequest;
      const adminId = authenticatedReq.user?.userId;
      const id = req.params.id as string;
      const { message } = req.body;

      const ticket = await supportService.replyToTicket(id, adminId!, message);

      res.status(200).json({
        success: true,
        data: ticket,
      });
    } catch (error) {
    next(error);
  }
  };

  updateTicketStatus = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const id = req.params.id as string;
      const { status } = req.body;

      const ticket = await supportService.updateTicketStatus(id, status);

      res.status(200).json({
        success: true,
        data: ticket,
      });
    } catch (error) {
    next(error);
  }
  };

  createAdminTicket = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const authenticatedReq = req as AuthenticatedRequest;
      const adminId = authenticatedReq.user?.userId;
      const { customerEmail, title, initialMessage } = req.body;

      const ticket = await supportService.createAdminTicket(
        adminId!,
        customerEmail,
        title,
        initialMessage,
      );

      res.status(201).json({
        success: true,
        data: ticket,
      });
    } catch (error) {
    next(error);
  }
  };
}
