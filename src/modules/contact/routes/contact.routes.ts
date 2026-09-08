import { Router } from "express";
import { ContactController } from "../controller/contact.controller";
import { authenticateToken, authorizeRoles } from "../../../shared/middlewares/auth.middleware";

const router = Router();
const controller = new ContactController();

// POST /api/contact is accessible to the public
router.post("/", controller.createContact);

// GET /api/contact/info is accessible to the public
router.get("/info", controller.getContactInfo);

// Admin-only endpoints
router.get("/", authenticateToken, authorizeRoles("ADMIN"), controller.getAllContacts);
router.put("/info", authenticateToken, authorizeRoles("ADMIN"), controller.updateContactInfo);
router.put("/:id/status", authenticateToken, authorizeRoles("ADMIN"), controller.updateContactStatus);
router.delete("/:id", authenticateToken, authorizeRoles("ADMIN"), controller.deleteContact);

export const contactRoutes = router;
