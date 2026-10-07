import mongoose from "mongoose";

const schema = new mongoose.Schema({
  transactionId: { type: String, required: true, unique: true },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  currency: { type: String, enum: ["VES", "SVES", "GEMS", "TOKENS", "SPINS"], required: true },
  type: { type: String, enum: [
    "REWARD", "BONUS", "REFERRAL", "DAILY_REWARD", "AD_REWARD", "GAME_REWARD",
    "ADMIN_CREDIT", "EXCHANGE_CREDIT", "WITHDRAWAL", "EXCHANGE_DEBIT",
    "ADMIN_DEBIT", "CORRECTION", "WITHDRAWAL_REVERSAL"
  ], required: true },
  amount: { type: Number, required: true, min: 1, validate: Number.isSafeInteger },
  balanceBefore: { type: Number, required: true, min: 0, validate: Number.isSafeInteger },
  balanceAfter: { type: Number, required: true, min: 0, validate: Number.isSafeInteger },
  direction: { type: String, enum: ["CREDIT", "DEBIT"], required: true },
  source: { type: String, required: true, trim: true, maxlength: 80 },
  referenceId: { type: String, index: true, maxlength: 100 },
  status: { type: String, enum: ["COMPLETED", "PENDING", "REVERSED"], default: "COMPLETED" },
  description: { type: String, trim: true, maxlength: 500 },
  metadata: { type: mongoose.Schema.Types.Mixed }
}, { timestamps: true });

schema.index({ userId: 1, createdAt: -1, _id: -1 });

export default mongoose.model("WalletTransaction", schema);

