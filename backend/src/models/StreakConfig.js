import mongoose from "mongoose";

const schema = new mongoose.Schema({
  _id: { type: String, required: true, default: "default" },
  active: { type: Boolean, default: true },
  timeZone: { type: String, required: true, default: "Asia/Kolkata" },
  milestoneDays: { type: Number, required: true, min: 1, validate: Number.isSafeInteger },
  milestoneRewardVES: { type: Number, required: true, min: 0, validate: Number.isSafeInteger }
}, { timestamps: true, versionKey: false });

export default mongoose.model("StreakConfig", schema);
