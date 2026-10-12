import mongoose from "mongoose";
const schema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  receiptId: { type: String, required: true, unique: true },
  idempotencyKey: { type: String, required: true, select: false },
  requestHash: { type: String, required: true, select: false },
  packageId: { type: String, required: true },
  status: { type: String, enum: ["SIMULATED_SUCCESS", "SIMULATED_FAILURE"], required: true },
  amount: { type: Number, required: true, min: 0, validate: Number.isSafeInteger },
  balanceBefore: { type: Number, required: true, min: 0, validate: Number.isSafeInteger },
  balanceAfter: { type: Number, required: true, min: 0, validate: Number.isSafeInteger },
  simulatedPricePaise: { type: Number, required: true },
  mode: { type: String, enum: ["DEMO"], default: "DEMO" }
}, { timestamps: true });
schema.index({ userId: 1, idempotencyKey: 1 }, { unique: true });
schema.index({ userId: 1, createdAt: -1 });
export default mongoose.model("DemoPayment", schema);
