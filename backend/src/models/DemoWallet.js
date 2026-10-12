import mongoose from "mongoose";
const schema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, unique: true },
  demoSves: { type: Number, default: 0, min: 0, max: 100000, validate: Number.isSafeInteger },
  demoGems: { type: Number, default: 0, min: 0, max: 100000, validate: Number.isSafeInteger },
  demoTokens: { type: Number, default: 0, min: 0, max: 100000, validate: Number.isSafeInteger },
  demoSpins: { type: Number, default: 0, min: 0, max: 100000, validate: Number.isSafeInteger },
  demoVes: { type: Number, default: 0, min: 0, max: 100000, validate: Number.isSafeInteger }
}, { timestamps: true });
export default mongoose.model("DemoWallet", schema);
