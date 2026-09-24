import { Router } from "express";
import { requireAuth } from "../middleware/auth.js";
import { create, list, detail } from "../controllers/withdrawalController.js";
import { validateWithdrawalId } from "../validators/requests.js";

const router = Router();
router.use(requireAuth);
router.post("/", create);
router.get("/", list);
router.get("/:id", validateWithdrawalId, detail);
export default router;

