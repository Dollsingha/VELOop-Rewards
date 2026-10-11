import "dotenv/config";
import mongoose from "mongoose";
import { connectDB } from "../src/config/db.js";
import { ensureStreakConfig } from "../src/services/streakConfigService.js";

try {
  await connectDB();
  const config = await ensureStreakConfig();
  console.log(`Streak reward config ready: ${config.active ? "active" : "inactive"}, ${config.milestoneDays}-day milestone, ${config.milestoneRewardVES} VEs, ${config.timeZone}.`);
} catch (error) {
  console.error("Streak configuration seed failed:", error.message);
  process.exitCode = 1;
} finally {
  await mongoose.disconnect();
}
