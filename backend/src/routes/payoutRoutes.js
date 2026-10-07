import { Router } from "express";
import { requireAuth } from "../middleware/auth.js";
import { methods, options } from "../controllers/payoutController.js";
import { validateMethod } from "../validators/requests.js";

const router = Router();
router.use(requireAuth);
router.get("/methods", methods);
router.get("/options/:method", validateMethod, options);
export default router;
