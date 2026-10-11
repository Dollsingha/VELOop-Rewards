import StreakConfig from "../models/StreakConfig.js";

const DEFAULT_STREAK_CONFIG = Object.freeze({
  _id: "default",
  active: true,
  timeZone: "Asia/Kolkata",
  milestoneDays: 10,
  milestoneRewardVES: 1000
});

export async function ensureStreakConfig() {
  await StreakConfig.updateOne(
    { _id: DEFAULT_STREAK_CONFIG._id },
    { $setOnInsert: DEFAULT_STREAK_CONFIG },
    { upsert: true, runValidators: true }
  );

  const config = await StreakConfig.findById(DEFAULT_STREAK_CONFIG._id).lean();
  if (!config || typeof config.active !== "boolean" || !config.timeZone ||
      !Number.isSafeInteger(config.milestoneDays) || config.milestoneDays < 1 ||
      !Number.isSafeInteger(config.milestoneRewardVES) || config.milestoneRewardVES < 0) {
    throw new Error("Streak rewards configuration is missing or invalid.");
  }

  try {
    new Intl.DateTimeFormat("en", { timeZone: config.timeZone }).format(new Date());
  } catch {
    throw new Error("Streak rewards time zone is invalid.");
  }

  return config;
}
