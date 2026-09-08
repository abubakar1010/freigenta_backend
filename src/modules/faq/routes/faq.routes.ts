import { Router } from "express";
import { FaqController } from "../controller/faq.controller";
import { authenticateToken, authorizeRoles } from "../../../shared/middlewares/auth.middleware";

const router = Router();
const controller = new FaqController();

// GET /api/faq is accessible to any public/anonymous user
router.get("/", controller.getAllFaqs);

// Write actions require administrative privileges
router.post("/", authenticateToken, authorizeRoles("ADMIN"), controller.createFaq);
router.put("/reorder", authenticateToken, authorizeRoles("ADMIN"), controller.reorderFaqs);
router.put("/:id", authenticateToken, authorizeRoles("ADMIN"), controller.updateFaq);
router.delete("/:id", authenticateToken, authorizeRoles("ADMIN"), controller.deleteFaq);

export const faqRoutes = router;
