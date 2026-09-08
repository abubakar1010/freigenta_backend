import { Router } from "express";
import { BankAccountController } from "../controller/bank.controller";
import { authenticateToken, authorizeRoles } from "../../../shared/middlewares/auth.middleware";

const router = Router();
const controller = new BankAccountController();

// Guard bank account configurations for administrative staff
router.use(authenticateToken, authorizeRoles("ADMIN", "OPS", "COMPLIANCE", "TREASURY"));

router.get("/", controller.getAllBanks);
router.post("/", controller.createBank);
router.put("/:id", controller.updateBank);
router.delete("/:id", controller.deleteBank);

export const bankRoutes = router;
