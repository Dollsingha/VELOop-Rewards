import mongoose from "mongoose";

const requiredDetailSchema = new mongoose.Schema({
  key: { type: String, required: true, match: /^[a-zA-Z][a-zA-Z0-9_]{0,39}$/ },
  label: { type: String, required: true, maxlength: 80 },
  inputType: { type: String, enum: ["text", "email"], default: "text" },
  required: { type: Boolean, default: true }
}, { _id: false });

const schema = new mongoose.Schema({
  methodId: { type: String, required: true, trim: true },
  method: { type: String, enum: ["upi", "paypal", "amazon", "google_play"], required: true },
  name: { type: String, required: true, trim: true },
  type: { type: String, enum: ["BANK_LIKE", "PAYPAL", "GIFT_CARD"], required: true },
  currency: { type: String, enum: ["VES"], default: "VES" },
  payoutCurrency: { type: String, enum: ["INR"], default: "INR" },
  payoutValue: { type: Number, required: true, min: 0, validate: Number.isSafeInteger },
  requiredAmount: { type: Number, required: true, min: 1, validate: Number.isSafeInteger },
  requiredDetails: { type: [requiredDetailSchema], default: [] },
  active: { type: Boolean, default: true, index: true },
  eligibility: { type: mongoose.Schema.Types.Mixed, default: {} },
  metadata: { type: mongoose.Schema.Types.Mixed, default: {} }
}, { timestamps: true });

schema.index({ method: 1, methodId: 1 }, { unique: true });
schema.index({ method: 1, active: 1, payoutValue: 1 });

export default mongoose.model("PayoutOption", schema);
