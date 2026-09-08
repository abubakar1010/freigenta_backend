import { Router } from "express";
import { SupportController } from "../controller/support.controller";
import { authenticateToken } from "../../../shared/middlewares/auth.middleware";

const router = Router();
const controller = new SupportController();

// GET /api/support/tickets — Get customer support tickets
router.get("/tickets", authenticateToken, controller.getTickets);

// POST /api/support/tickets — Create a new support ticket
router.post("/tickets", authenticateToken, controller.createTicket);

// POST /api/support/tickets/:id/messages — Customer reply to a ticket
router.post("/tickets/:id/messages", authenticateToken, controller.replyToTicket);

export const supportRoutes = router;
