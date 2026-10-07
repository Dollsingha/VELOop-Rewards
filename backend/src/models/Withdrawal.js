import mongoose from "mongoose";

const schema = new mongoose.Schema({
  withdrawalId: { type: String, required: true, unique: true },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
  method: { type: String, enum: ["upi", "paypal", "amazon", "google_play"], required: true },
  optionId: { type: String, required: true },
  currency: { type: String, enum: ["VES"], required: true },
  currencyAmount: { type: Number, required: true, min: 1, validate: Number.isSafeInteger },
  payoutAmount: { type: Number, required: true, min: 0, validate: Number.isSafeInteger },
  payoutCurrency: { type: String, required: true, default: "INR", match: /^[A-Z]{3}$/ },
  payoutDetailsEncrypted: { type: String, required: true, select: false },
  requestHash: { type: String, required: true, select: false },
  status: {
    type: String,
    enum: ["PENDING", "PROCESSING", "APPROVED", "REJECTED", "CANCELLED"],
    default: "PENDING",
    index: true
  },
  rejectionReason: { type: String, maxlength: 500 },
  reviewNote: { type: String, maxlength: 1000 },
  transactionId: { type: String, required: true, index: true },
  idempotencyKey: { type: String, required: true },
  requestedAt: { type: Date, default: Date.now, index: true },
  processedAt: Date
}, { timestamps: true });

schema.index({ userId: 1, idempotencyKey: 1 }, { unique: true });
schema.index({ userId: 1, createdAt: -1, _id: -1 });
schema.index({ status: 1, requestedAt: 1 });

export default mongoose.model("Withdrawal", schema);
