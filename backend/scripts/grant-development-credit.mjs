// Operator-only CLI. Never exposed as a member HTTP endpoint or run by default.
import "dotenv/config";
import crypto from "node:crypto";
import { parseArgs } from "node:util";
import mongoose from "mongoose";
import User from "../src/models/User.js";
import AuditLog from "../src/models/AuditLog.js";
import { connectDB } from "../src/config/db.js";
import { creditWallet, withTransaction } from "../src/services/walletService.js";

const { values } = parseArgs({ options: {
  database: { type: "string" }, "user-id": { type: "string" },
  amount: { type: "string" }, reference: { type: "string" },
  "allow-development-credit": { type: "boolean", default: false }
} });

try {
  const amount = Number(values.amount);
  const userId = values["user-id"];
  if (!values["allow-development-credit"] || !values.database ||
      !/^[a-f0-9]{24}$/i.test(userId || "") || !Number.isSafeInteger(amount) || amount < 1 || amount > 25000 ||
      !/^[A-Za-z0-9_-]{8,80}$/.test(values.reference || "")) {
    throw new Error("Supply an explicit development database, user ID, amount 1–25000, reference and --allow-development-credit.");
  }
  const database = decodeURIComponent(new URL(process.env.MONGO_URI || "").pathname.slice(1));
  if (database !== values.database) throw new Error("The configured database does not match the explicitly authorized development database.");
  await connectDB();
  const markerId = new mongoose.Types.ObjectId(crypto.createHash("sha256").update(`development-credit:${values.reference}`).digest("hex").slice(0, 24));
  function replay(marker) {
    if (String(marker.targetUserId) !== userId || marker.metadata?.amount !== amount || marker.referenceId !== values.reference || marker.action !== "DEVELOPMENT_TEST_CREDIT") {
      throw new Error("This reference already belongs to a different operation. No credit applied.");
    }
    return { applied: false, alreadyApplied: true, transactionId: marker.metadata.transactionId, balanceAfterCredit: marker.metadata.balanceAfter };
  }
  let result;
  try {
    result = await withTransaction(async session => {
      const prior = await AuditLog.findById(markerId).session(session).lean();
      if (prior) return replay(prior);
      const user = await User.findOne({ _id: userId, accountStatus: "ACTIVE" }).session(session);
      if (!user) throw new Error("The authorized active member was not found. No account created.");
      const { ledger } = await creditWallet({ userId, currency: "VES", amount, type: "BONUS", source: "DEVELOPMENT_TEST_CREDIT",
        referenceId: values.reference, description: "Development withdrawal testing credit — not a cash purchase",
        metadata: { purpose: "Owner-authorized withdrawal testing", bankMoney: false }, session });
      await AuditLog.create([{ _id: markerId, action: "DEVELOPMENT_TEST_CREDIT", targetUserId: userId,
        targetType: "Wallet", referenceId: values.reference,
        metadata: { amount, currency: "VES", transactionId: ledger.transactionId, balanceBefore: ledger.balanceBefore, balanceAfter: ledger.balanceAfter, authorization: "Project owner requested development withdrawal test balance", bankMoney: false }
      }], { session });
      return { applied: true, transactionId: ledger.transactionId, balanceBefore: ledger.balanceBefore, balanceAfterCredit: ledger.balanceAfter };
    });
  } catch (error) {
    if (error.code !== 11000) throw error;
    const marker = await AuditLog.findById(markerId).lean();
    if (!marker) throw error;
    result = replay(marker);
  }
  console.log(JSON.stringify({ success: true, reference: values.reference, ...result }));
} catch (error) {
  // Do not print connection strings, driver diagnostics or credentials.
  console.error(error.name === "MongoServerError" || error.name === "MongoServerSelectionError" ? "Development credit could not be confirmed. Check database connectivity and the ledger before retrying." : error.message);
  process.exitCode = 1;
} finally {
  await mongoose.disconnect();
}
