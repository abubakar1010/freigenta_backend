import { Router } from "express";
import { AdminSupportController } from "../controller/support.controller";
import { authenticateToken, authorizeRoles } from "../../../shared/middlewares/auth.middleware";

const router = Router();
const controller = new AdminSupportController();

// Secure admin support endpoints for Admin role only
router.use(authenticateToken, authorizeRoles("ADMIN"));

router.get("/", controller.getAllTickets);
router.post("/:id/reply", controller.replyToTicket);
router.put("/:id/status", controller.updateTicketStatus);
router.post("/", controller.createAdminTicket);

export const adminSupportRoutes = router;
