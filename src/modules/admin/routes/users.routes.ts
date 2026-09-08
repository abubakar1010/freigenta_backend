import { Router } from "express";
import { AdminUsersController } from "../controller/users.controller";
import { authenticateToken, authorizeRoles } from "../../../shared/middlewares/auth.middleware";

const router = Router();
const controller = new AdminUsersController();

// Guard all user management endpoints for staff roles
router.use(authenticateToken, authorizeRoles("ADMIN", "OPS", "COMPLIANCE", "TREASURY"));

router.get("/", controller.getUsers);
router.get("/:id", controller.getUserById);
router.post("/:id/toggle-status", controller.toggleUserStatus);
router.post("/:id/change-role", controller.changeUserRole);

export const usersRoutes = router;
