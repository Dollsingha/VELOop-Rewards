import bcrypt from "bcryptjs";
import { OAuth2Client } from "google-auth-library";
import User from "../models/User.js";
import Wallet from "../models/Wallet.js";
import { signToken } from "../utils/jwt.js";
import { httpError } from "../utils/httpError.js";
import { withTransaction } from "../services/walletService.js";

const googleClient = new OAuth2Client();

export async function register(req, res, next) {
  try {
    const { name, email, password } = req.body;
    if (!name || !email || !password || password.length < 10) {
      throw httpError("Name, valid email and password of at least 10 characters are required.", 400);
    }

    const normalizedEmail = email.trim().toLowerCase();
    if (await User.exists({ email: normalizedEmail })) {
      throw httpError("Email is already registered.", 409);
    }

    const hashed = await bcrypt.hash(password, 12);
    const user = await withTransaction(async session => {
      const [createdUser] = await User.create([{
        name: name.trim(), email: normalizedEmail, password: hashed
      }], { session });
      await Wallet.create([{ userId: createdUser._id }], { session });
      return createdUser;
    });

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
    if (!user?.password || !(await bcrypt.compare(password || "", user.password))) {
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

export async function googleSignIn(req, res, next) {
  try {
    const clientId = process.env.GOOGLE_CLIENT_ID;
    const credential = req.body?.credential;
    if (!clientId) throw httpError("Google sign-in is not configured on this server.", 503);
    if (typeof credential !== "string" || credential.length > 10000) {
      throw httpError("A valid Google credential is required.", 400);
    }

    let payload;
    try {
      const ticket = await googleClient.verifyIdToken({ idToken: credential, audience: clientId });
      payload = ticket.getPayload();
    } catch {
      throw httpError("Google sign-in could not be verified. Please try again.", 401);
    }

    const subject = payload?.sub;
    const email = payload?.email?.trim().toLowerCase();
    if (!subject || !email || payload.email_verified !== true) {
      throw httpError("Google must provide a verified email address.", 401);
    }

    let user = await User.findOne({ googleSub: subject }).select("+googleSub");
    if (!user) {
      const emailIsAuthoritative = email.endsWith("@gmail.com") || Boolean(payload.hd);
      const existingEmailUser = await User.findOne({ email }).select("+googleSub");
      if (existingEmailUser) {
        if (!emailIsAuthoritative) {
          throw httpError("This email already has an account. Sign in with your password first.", 409);
        }
        if (existingEmailUser.googleSub && existingEmailUser.googleSub !== subject) {
          throw httpError("This account is already linked to another Google account.", 409);
        }
        existingEmailUser.googleSub = subject;
        await existingEmailUser.save();
        user = existingEmailUser;
      } else {
        user = await withTransaction(async session => {
          const [createdUser] = await User.create([{
            name: (payload.name || email.split("@")[0]).trim().slice(0, 100),
            email,
            googleSub: subject
          }], { session });
          await Wallet.create([{ userId: createdUser._id }], { session });
          return createdUser;
        });
      }
    }

    if (user.accountStatus !== "ACTIVE") throw httpError("Account is not active.", 403);
    res.json({
      success: true,
      token: signToken(user),
      user: { id: user._id, name: user.name, email: user.email, role: user.role }
    });
  } catch (e) { next(e); }
}

