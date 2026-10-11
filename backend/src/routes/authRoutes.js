import { Router } from "express";
import { register, login, googleSignIn } from "../controllers/authController.js";
import { validateRegister, validateLogin } from "../validators/requests.js";

const router = Router();
router.post("/register", validateRegister, register);
router.post("/login", validateLogin, login);
router.post("/google", googleSignIn);
export default router;

