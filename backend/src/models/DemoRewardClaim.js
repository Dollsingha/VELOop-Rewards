import mongoose from "mongoose";
const entrySchema = new mongoose.Schema({
  currency: { type: String, enum: ["SVES", "GEMS", "TOKENS", "SPINS"], required: true },
  amount: { type: Number, min: 1, required: true, validate: Number.isSafeInteger },
  balanceBefore: { type: Number, min: 0, required: true, validate: Number.isSafeInteger },
  balanceAfter: { type: Number, min: 0, required: true, validate: Number.isSafeInteger }
}, { _id: false });
const schema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, unique: true },
  claimId: { type: String, required: true, unique: true },
  mode: { type: String, enum: ["DEMO"], default: "DEMO" },
  packId: { type: String, required: true },
  entries: { type: [entrySchema], required: true }
}, { timestamps: true });
export default mongoose.model("DemoRewardClaim", schema);
