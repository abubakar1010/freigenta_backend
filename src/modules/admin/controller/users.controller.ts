import { Request, Response, NextFunction } from "express";
import { AdminUsersService } from "../service/users.service";

const usersService = new AdminUsersService();

export class AdminUsersController {
  getUsers = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const page = Math.max(1, parseInt(req.query.page as string) || 1);
      const limit = Math.max(1, parseInt(req.query.limit as string) || 10);
      const search = (req.query.search as string || "").trim();
      const roleFilter = (req.query.role as string || "All").trim();

      const data = await usersService.getUsers(page, limit, search, roleFilter);

      res.status(200).json({
        success: true,
        data,
      });
    } catch (error) {
    next(error);
  }
  };

  toggleUserStatus = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const id = req.params.id as string;
      const callerId = (req as any).user?.userId;
      if (callerId && id === callerId) {
        res.status(400).json({
          success: false,
          message: "You cannot disable your own administrator account."
        });
        return;
      }

      const data = await usersService.toggleUserStatus(id);

      res.status(200).json({
        success: true,
        message: `User status changed to ${data.status}`,
        data,
      });
    } catch (error) {
    next(error);
  }
  };

  changeUserRole = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const id = req.params.id as string;
      const callerId = (req as any).user?.userId;
      if (callerId && id === callerId) {
        res.status(400).json({
          success: false,
          message: "You cannot edit or demote your own administrator role."
        });
        return;
      }

      const { role } = req.body;

      const data = await usersService.changeUserRole(id, role);

      res.status(200).json({
        success: true,
        message: "User role updated successfully",
        data,
      });
    } catch (error) {
    next(error);
  }
  };

  getUserById = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const id = req.params.id as string;
      const data = await usersService.getUserById(id);

      res.status(200).json({
        success: true,
        data,
      });
    } catch (error) {
    next(error);
  }
  };
}
