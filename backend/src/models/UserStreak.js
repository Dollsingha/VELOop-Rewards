import mongoose from "mongoose";

const schema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, unique: true },
  currentStreak: { type: Number, required: true, min: 0, default: 0, validate: Number.isSafeInteger },
  longestStreak: { type: Number, required: true, min: 0, default: 0, validate: Number.isSafeInteger },
  lastCheckInDay: { type: String, match: /^\d{4}-\d{2}-\d{2}$/ },
  lastCheckInAt: Date
}, { timestamps: true });

export default mongoose.model("UserStreak", schema);
