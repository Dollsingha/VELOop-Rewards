import { Router } from "express";
import { register, login } from "../controllers/authController.js";
import { validateRegister, validateLogin } from "../validators/requests.js";

const router = Router();
router.post("/register", validateRegister, register);
router.post("/login", validateLogin, login);
export default router;
