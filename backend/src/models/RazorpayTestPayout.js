import mongoose from "mongoose";

const schema = new mongoose.Schema({
  _id: { type: String, required: true }, // The immutable withdrawal ID.
  state: { type: String, enum: ["SUBMITTING", "UNKNOWN", "SUBMITTED"], required: true },
  idempotencyKey: { type: String, required: true, select: false },
  accountNumber: { type: String, required: true, select: false },
  keyFingerprint: { type: String, required: true, select: false },
  expectedAmount: { type: Number, required: true, min: 100, validate: Number.isSafeInteger },
  payoutId: { type: String, match: /^pout_[A-Za-z0-9]+$/, unique: true, sparse: true },
  providerStatus: { type: String, maxlength: 30 }
}, { timestamps: true, versionKey: false });

export default mongoose.model("RazorpayTestPayout", schema);
