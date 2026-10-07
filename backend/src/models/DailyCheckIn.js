import mongoose from "mongoose";

const schema = new mongoose.Schema({
  checkInId: { type: String, required: true, unique: true },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  dayKey: { type: String, required: true, match: /^\d{4}-\d{2}-\d{2}$/ },
  streakDay: { type: Number, required: true, min: 1, validate: Number.isSafeInteger },
  bonusVES: { type: Number, required: true, min: 0, validate: Number.isSafeInteger }
}, { timestamps: true });

schema.index({ userId: 1, dayKey: 1 }, { unique: true });

export default mongoose.model("DailyCheckIn", schema);
