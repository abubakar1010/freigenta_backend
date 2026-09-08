import { Router } from "express";
import { NewsController } from "../controller/news.controller";
import { authenticateToken, authorizeRoles } from "../../../shared/middlewares/auth.middleware";

const router = Router();
const controller = new NewsController();

// GET /api/news is accessible to the public
router.get("/", controller.getAllNews);
router.get("/:id", controller.getNewsById);

// Write actions require administrative privileges
router.post("/", authenticateToken, authorizeRoles("ADMIN"), controller.createNews);
router.put("/:id", authenticateToken, authorizeRoles("ADMIN"), controller.updateNews);
router.delete("/:id", authenticateToken, authorizeRoles("ADMIN"), controller.deleteNews);

export const newsRoutes = router;
