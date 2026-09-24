import { Router } from "express";
import { requireAuth } from "../middleware/auth.js";
import { wallet, summary, transactions } from "../controllers/walletController.js";

const router = Router();
router.use(requireAuth);
router.get("/", wallet);
router.get("/summary", summary);
router.get("/transactions", transactions);
export default router;
