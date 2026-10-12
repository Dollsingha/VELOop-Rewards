import { Router } from "express";
import { requireAuth } from "../middleware/auth.js";
import { createPaymentOrder, listPackages, verifyPayment } from "../controllers/paymentController.js";

const router = Router();
router.use(requireAuth);
router.get("/packages", listPackages);
router.post("/orders", createPaymentOrder);
router.post("/verify", verifyPayment);
export default router;
