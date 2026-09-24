import { Router } from "express";
import { requireAuth } from "../middleware/auth.js";
import { methods, options } from "../controllers/payoutController.js";

const router = Router();
router.use(requireAuth);
router.get("/methods", methods);
router.get("/options/:method", options);
export default router;
