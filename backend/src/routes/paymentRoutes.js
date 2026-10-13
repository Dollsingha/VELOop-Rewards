import { Router } from "express";
import { requireAuth } from "../middleware/auth.js";
import { createPaymentOrder, listPackages, listOrders, verifyPayment, reconcilePayment } from "../controllers/paymentController.js";



const router = Router();
router.use(requireAuth);
router.get("/packages", listPackages);
router.get("/orders", listOrders);
router.post("/orders", createPaymentOrder);
router.post("/orders/:id/reconcile", reconcilePayment);
router.post("/verify", verifyPayment);
export default router;
