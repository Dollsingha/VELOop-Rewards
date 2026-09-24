import "dotenv/config";
import bcrypt from "bcryptjs";
import { connectDB } from "../src/config/db.js";
import User from "../src/models/User.js";
import Wallet from "../src/models/Wallet.js";
import WalletTransaction from "../src/models/WalletTransaction.js";
import PayoutOption from "../src/models/PayoutOption.js";

const expected = { VES: 25000, SVES: 5000, GEMS: 100, TOKENS: 500, SPINS: 3 };
const fieldMap = { VES: "ves", SVES: "sves", GEMS: "gems", TOKENS: "tokens", SPINS: "spins" };
const payouts = [
  [10, 2400], [25, 5800], [50, 10000], [100, 19500],
  [150, 28500], [300, 52500], [500, 80500], [1000, 150000]
];

try {
  if (process.env.NODE_ENV === "production") throw new Error("The demo seed is disabled in production.");
  await connectDB();
  const password = await bcrypt.hash("Demo@12345", 12);
  const user = await User.findOneAndUpdate(
    { email: "demo@veloop.test" },
    { $setOnInsert: { name: "VELOop Demo User", email: "demo@veloop.test", password, role: "USER" } },
    { upsert: true, new: true }
  );
  await User.findOneAndUpdate(
    { email: "admin@veloop.test" },
    { $setOnInsert: { name: "VELOop Demo Admin", email: "admin@veloop.test", password, role: "ADMIN" } },
    { upsert: true, new: true }
  );

  let wallet = await Wallet.findOne({ userId: user._id });
  if (!wallet) wallet = await Wallet.create({ userId: user._id, ...Object.fromEntries(Object.entries(expected).map(([currency, amount]) => [fieldMap[currency], amount])) });

  const rows = [];
  const addOpening = (currency, amount, id, createdAt = new Date()) => {
    if (!amount) return;
    rows.push({
      transactionId: id, userId: user._id, currency, type: "BONUS", amount,
      balanceBefore: 0, balanceAfter: amount, direction: "CREDIT",
      source: "DEMO_SEED", status: "COMPLETED", description: "Demo opening balance",
      createdAt, updatedAt: createdAt
    });
  };
  const count = await WalletTransaction.countDocuments({ userId: user._id });
  if (count === 0) {
    if (wallet.ves === expected.VES) {
      addOpening("VES", 24000, "seed_opening_ves");
      const credits = [
        ["seed_referral", 400, "Referral Reward", "REFERRAL"],
        ["seed_daily_reward", 100, "Daily Reward", "DAILY_REWARD"],
        ["seed_ad_reward", 500, "Watch Ad Reward", "AD_REWARD"]
      ];
      let balance = 24000;
      for (const [id, amount, description, type] of credits) {
        rows.push({
          transactionId: id, userId: user._id, currency: "VES", type, amount,
          balanceBefore: balance, balanceAfter: balance + amount, direction: "CREDIT",
          source: type, status: "COMPLETED", description
        });
        balance += amount;
      }
    } else addOpening("VES", wallet.ves, "seed_opening_ves");
    for (const currency of ["SVES", "GEMS", "TOKENS", "SPINS"]) {
      addOpening(currency, wallet[fieldMap[currency]], `seed_opening_${currency.toLowerCase()}`);
    }
    if (rows.length) await WalletTransaction.insertMany(rows);
  } else {
    // Repair the former demo seed, whose transaction history omitted the opening balance.
    const legacyIds = ["seed_referral", "seed_daily_reward", "seed_ad_reward"];
    const legacy = await WalletTransaction.find({ userId: user._id, transactionId: { $in: legacyIds } }).sort({ createdAt: 1, _id: 1 });
    if (legacy.length === legacyIds.length && !(await WalletTransaction.exists({ transactionId: "seed_opening_ves" }))) {
      const firstTime = legacy[0].createdAt;
      const openingAt = new Date(firstTime.getTime() - 3000);
      addOpening("VES", 24000, "seed_opening_ves", openingAt);
      const order = ["seed_referral", "seed_daily_reward", "seed_ad_reward"];
      for (let index = 0; index < order.length; index += 1) {
        const timestamp = new Date(openingAt.getTime() + (index + 1) * 1000);
        await WalletTransaction.updateOne({ transactionId: order[index] }, { $set: { createdAt: timestamp, updatedAt: timestamp } });
      }
    }
    for (const currency of ["SVES", "GEMS", "TOKENS", "SPINS"]) {
      const id = `seed_opening_${currency.toLowerCase()}`;
      if (!(await WalletTransaction.exists({ userId: user._id, currency })) && wallet[fieldMap[currency]] > 0) {
        addOpening(currency, wallet[fieldMap[currency]], id);
      }
    }
    if (rows.length) await WalletTransaction.insertMany(rows);
  }

  // Disable only the unsupported demo rows from the previous seed; preserve other admin configuration.
  await PayoutOption.updateMany(
    { method: { $in: ["amazon", "google_play"] }, methodId: /^(amazon|google_play)_10$/ },
    { $set: { active: false } }
  );
  const requiredDetails = [{ key: "upiId", label: "UPI ID", inputType: "text", required: true }];
  for (const [payoutValue, requiredAmount] of payouts) {
    await PayoutOption.updateOne(
      { method: "upi", methodId: `upi_${payoutValue}` },
      { $set: {
        name: "UPI", type: "BANK_LIKE", currency: "VES", payoutCurrency: "INR", payoutValue,
        requiredAmount, requiredDetails, active: true,
        eligibility: { accountStatus: "ACTIVE" }
      } },
      { upsert: true }
    );
  }

  console.log("Development seed complete. Enabled payout options: 8 UPI denominations.");
  console.log("Demo user: demo@veloop.test / Demo@12345");
  console.log("Demo admin: admin@veloop.test / Demo@12345");
} catch (error) {
  console.error("Seed failed:", error.message);
  process.exitCode = 1;
} finally {
  const mongoose = (await import("mongoose")).default;
  await mongoose.disconnect();
}


