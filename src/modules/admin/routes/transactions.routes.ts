import { Router } from "express";
import { AdminTransactionsController } from "../controller/transactions.controller";
import { authenticateToken, authorizeRoles } from "../../../shared/middlewares/auth.middleware";

const router = Router();
const controller = new AdminTransactionsController();

// Secure transactions endpoint for Admin role only
router.use(authenticateToken, authorizeRoles("ADMIN"));

router.get("/", controller.getTransactions);

export const transactionsRoutes = router;
