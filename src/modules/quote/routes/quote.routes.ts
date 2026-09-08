import { Router } from "express";
import { generateQuote, respondToQuote, getCustomerQuotes, getOpsQuotes } from "../controller/quote.controller";
import { authenticateToken, authorizeRoles } from "../../../shared/middlewares/auth.middleware";

const router = Router();

router.use(authenticateToken);

// Customer endpoints
router.post("/:id/respond", authorizeRoles("CUSTOMER"), respondToQuote);
router.get("/customer", authorizeRoles("CUSTOMER"), getCustomerQuotes);

// Operations/Admin endpoints
router.post("/generate", authorizeRoles("OPS", "ADMIN"), generateQuote);
router.get("/ops", authorizeRoles("OPS", "ADMIN"), getOpsQuotes);

export const quoteRoutes = router;
