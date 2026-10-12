import { Router } from "express";
import { requireAuth } from "../middleware/auth.js";
import { createPaymentOrder, listPackages, listOrders, verifyPayment, reconcilePayment } from "../controllers/paymentController.js";

import { overview as demoOverview, simulate as demoSimulate } from "../controllers/demoPaymentController.js";

const router = Router();
router.use(requireAuth);
router.get("/demo", demoOverview);
router.post("/demo", demoSimulate);
router.get("/packages", listPackages);
router.get("/orders", listOrders);
router.post("/orders", createPaymentOrder);
router.post("/orders/:id/reconcile", reconcilePayment);
router.post("/verify", verifyPayment);
export default router;
