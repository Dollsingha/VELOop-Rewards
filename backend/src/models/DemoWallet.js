import mongoose from "mongoose";
const schema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, unique: true },
  demoVes: { type: Number, default: 0, min: 0, max: 100000, validate: Number.isSafeInteger }
}, { timestamps: true });
export default mongoose.model("DemoWallet", schema);
