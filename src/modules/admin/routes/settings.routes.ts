import { Router } from "express";
import { SettingsController } from "../controller/settings.controller";
import { authenticateToken, authorizeRoles } from "../../../shared/middlewares/auth.middleware";

const router = Router();
const controller = new SettingsController();

// Public route to view settings (Privacy Policy and Cover Image)
router.get("/public", controller.getSettings);

// Guard write settings endpoints for ADMIN only
router.use(authenticateToken, authorizeRoles("ADMIN"));

router.get("/", controller.getSettings);
router.put("/", controller.updateSettings);

export const settingsRoutes = router;
