import { Router } from "express";
import { requireAuth } from "../middleware/auth.js";
import { wallet, summary, transactions } from "../controllers/walletController.js";
import { validatePagination } from "../validators/requests.js";
import { checkIn, streak } from "../controllers/streakController.js";

const router = Router();
router.use(requireAuth);
router.get("/", wallet);
router.get("/summary", summary);
router.get("/transactions", validatePagination, transactions);
router.get("/streak", streak);
router.post("/streak/check-in", checkIn);
export default router;
