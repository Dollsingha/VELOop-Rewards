import mongoose from "mongoose";

const schema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, unique: true },
  ves: { type: Number, default: 0, min: 0, validate: Number.isSafeInteger },
  sves: { type: Number, default: 0, min: 0, validate: Number.isSafeInteger },
  gems: { type: Number, default: 0, min: 0, validate: Number.isSafeInteger },
  tokens: { type: Number, default: 0, min: 0, validate: Number.isSafeInteger },
  spins: { type: Number, default: 0, min: 0, validate: Number.isSafeInteger }
}, { timestamps: true });

export default mongoose.model("Wallet", schema);

