import bcrypt from "bcryptjs";
import User from "../models/User.js";
import Wallet from "../models/Wallet.js";
import { signToken } from "../utils/jwt.js";
import { httpError } from "../utils/httpError.js";

export async function register(req, res, next) {
  try {
    const { name, email, password } = req.body;
    if (!name || !email || !password || password.length < 8) {
      throw httpError("Name, valid email and password of at least 8 characters are required.", 400);
    }

    const normalizedEmail = email.trim().toLowerCase();
    if (await User.exists({ email: normalizedEmail })) {
      throw httpError("Email is already registered.", 409);
    }

    const hashed = await bcrypt.hash(password, 12);
    const user = await User.create({ name: name.trim(), email: normalizedEmail, password: hashed });
    await Wallet.create({ userId: user._id });

    res.status(201).json({
      success: true,
      token: signToken(user),
      user: { id: user._id, name: user.name, email: user.email, role: user.role }
    });
  } catch (e) { next(e); }
}

export async function login(req, res, next) {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email: email?.trim().toLowerCase() }).select("+password");
    if (!user || !(await bcrypt.compare(password || "", user.password))) {
      throw httpError("Invalid email or password.", 401);
    }
    if (user.accountStatus !== "ACTIVE") throw httpError("Account is not active.", 403);

    res.json({
      success: true,
      token: signToken(user),
      user: { id: user._id, name: user.name, email: user.email, role: user.role }
    });
  } catch (e) { next(e); }
}
