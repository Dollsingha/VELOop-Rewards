import bcrypt from "bcryptjs";
import mongoose from "mongoose";
import User from "../models/User.js";
import Wallet from "../models/Wallet.js";
import AuditLog from "../models/AuditLog.js";
import { creditWallet, withTransaction } from "./walletService.js";

const referenceId = "assessment-review-opening-v1";
export async function ensureAssessmentAccount() {
  if (process.env.ASSESSMENT_REVIEW_ENABLED !== "true") return null;
  if (!process.env.ASSESSMENT_DB_NAME || mongoose.connection.name !== process.env.ASSESSMENT_DB_NAME) {
    throw new Error("Assessment seed requires an explicit matching development database name.");
  }
  const email = process.env.ASSESSMENT_REVIEW_EMAIL?.trim().toLowerCase();
  const password = process.env.ASSESSMENT_REVIEW_PASSWORD;
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || !password || password.length < 20) {
    throw new Error("Assessment review account requires a valid email and a private password of at least 20 characters.");
  }
  const hashed = await bcrypt.hash(password, 12);
  return withTransaction(async session => {
    const existing = await User.findOne({ email }).session(session);
    if (existing) {
      const marker = await AuditLog.findOne({ action: "ASSESSMENT_ACCOUNT_SEEDED", referenceId, targetUserId: existing._id }).session(session);
      if (!marker) throw new Error("Assessment email is already in use. Existing accounts are never modified by this seed.");
      return { email: existing.email, created: false };
    }
    const [user] = await User.create([{ name: "Wallet Assessment Review", email, password: hashed, role: "USER", accountStatus: "ACTIVE" }], { session });
    await Wallet.create([{ userId: user._id }], { session });
    const entries = [
      ["VES", 24000, "BONUS", "Assessment opening VEs"],
      ["VES", 400, "REFERRAL", "Assessment referral sample"],
      ["VES", 100, "DAILY_REWARD", "Assessment daily reward sample"],
      ["VES", 500, "AD_REWARD", "Assessment ad reward sample"],
      ["SVES", 5000, "BONUS", "Assessment opening SVEs"],
      ["GEMS", 100, "BONUS", "Assessment opening Gems"],
      ["TOKENS", 500, "BONUS", "Assessment opening Tokens"],
      ["SPINS", 3, "BONUS", "Assessment opening Spins"]
    ];
    for (const [currency, amount, type, description] of entries) {
      const { ledger } = await creditWallet({ userId: user._id, currency, amount, type,
        source: "ASSESSMENT_SEED", referenceId, description, session });
      await AuditLog.create([{ actorId: user._id, targetUserId: user._id, action: "ASSESSMENT_SEED_CREDIT",
        targetType: "Wallet", referenceId: ledger.transactionId,
        metadata: { currency, amount, balanceBefore: ledger.balanceBefore, balanceAfter: ledger.balanceAfter, developmentFixture: true }
      }], { session });
    }
    await AuditLog.create([{ actorId: user._id, targetUserId: user._id, action: "ASSESSMENT_ACCOUNT_SEEDED",
      targetType: "User", referenceId, metadata: { developmentFixture: true } }], { session });
    return { email: user.email, created: true };
  });
}
