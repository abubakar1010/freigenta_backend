import { Router } from "express";
import { CareerController } from "../controller/careers.controller";
import { authenticateToken, authorizeRoles } from "../../../shared/middlewares/auth.middleware";

const router = Router();
const controller = new CareerController();

// GET /api/careers is open to the public (filtered dynamically by role)
router.get("/", controller.getAllJobPostings);
router.get("/:id", controller.getJobPostingById);

// Write actions require ADMIN credentials
router.post("/", authenticateToken, authorizeRoles("ADMIN"), controller.createJobPosting);
router.put("/:id", authenticateToken, authorizeRoles("ADMIN"), controller.updateJobPosting);
router.put("/:id/status", authenticateToken, authorizeRoles("ADMIN"), controller.toggleJobStatus);
router.delete("/:id", authenticateToken, authorizeRoles("ADMIN"), controller.deleteJobPosting);

export const careerRoutes = router;
