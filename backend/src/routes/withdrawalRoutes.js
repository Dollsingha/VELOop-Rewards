import { Router } from "express";
import { requireAuth } from "../middleware/auth.js";
import { create, list, detail, cancel } from "../controllers/withdrawalController.js";
import { validateWithdrawal, validatePagination, validateWithdrawalId } from "../validators/requests.js";

const router = Router();
router.use(requireAuth);
router.post("/", validateWithdrawal, create);
router.get("/", validatePagination, list);
router.post("/:id/cancel", validateWithdrawalId, cancel);
router.get("/:id", validateWithdrawalId, detail);
export default router;

