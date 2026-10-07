import crypto from "crypto";
import AuditLog from "../models/AuditLog.js";
import DailyCheckIn from "../models/DailyCheckIn.js";
import StreakConfig from "../models/StreakConfig.js";
import UserStreak from "../models/UserStreak.js";
import { creditWallet, withTransaction } from "./walletService.js";
import { httpError } from "../utils/httpError.js";

const MS_PER_DAY = 86_400_000;
const DEFAULT_TIME_ZONE = "Asia/Kolkata";

function partsForDay(dayKey) {
  const [year, month, day] = dayKey.split("-").map(Number);
  return { year, month, day };
}

function dateKeyFromParts({ year, month, day }) {
  return `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function shiftDay(dayKey, amount) {
  const { year, month, day } = partsForDay(dayKey);
  const shifted = new Date(Date.UTC(year, month - 1, day + amount));
  return dateKeyFromParts({ year: shifted.getUTCFullYear(), month: shifted.getUTCMonth() + 1, day: shifted.getUTCDate() });
}

function dayDistance(later, earlier) {
  const a = partsForDay(later);
  const b = partsForDay(earlier);
  return (Date.UTC(a.year, a.month - 1, a.day) - Date.UTC(b.year, b.month - 1, b.day)) / MS_PER_DAY;
}

export function streakDayKey(at = new Date(), timeZone = DEFAULT_TIME_ZONE) {
  const parts = new Intl.DateTimeFormat("en", {
    timeZone, year: "numeric", month: "2-digit", day: "2-digit"
  }).formatToParts(at);
  const values = Object.fromEntries(parts.filter(part => part.type !== "literal").map(part => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

async function loadConfig() {
  const config = await StreakConfig.findById("default").lean();
  if (!config || !Number.isSafeInteger(config.milestoneDays) || config.milestoneDays < 1 ||
      !Number.isSafeInteger(config.milestoneRewardVES) || config.milestoneRewardVES < 0) {
    throw httpError("Streak rewards are not configured.", 503);
  }
  try { new Intl.DateTimeFormat("en", { timeZone: config.timeZone }).format(new Date()); }
  catch { throw httpError("Streak time zone is not configured correctly.", 503); }
  return config;
}

export async function getStreak(userId) {
  const config = await loadConfig();
  const today = streakDayKey(new Date(), config.timeZone);
  const [state, checkIns] = await Promise.all([
    UserStreak.findOne({ userId }).lean(),
    DailyCheckIn.find({ userId, dayKey: { $gte: shiftDay(today, -6), $lte: today } }).select("dayKey").lean()
  ]);

  const gap = state?.lastCheckInDay ? dayDistance(today, state.lastCheckInDay) : Infinity;
  const currentStreak = gap <= 1 ? state.currentStreak : 0;
  const checkedInToday = gap === 0;
  const checkInDays = new Set(checkIns.map(item => item.dayKey));
  const week = Array.from({ length: 7 }, (_, index) => {
    const dayKey = shiftDay(today, index - 6);
    const { year, month, day } = partsForDay(dayKey);
    const weekday = new Intl.DateTimeFormat("en", { timeZone: "UTC", weekday: "short" })
      .format(new Date(Date.UTC(year, month - 1, day, 12)));
    return { dayKey, weekday, checkedIn: checkInDays.has(dayKey), isToday: dayKey === today };
  });
  const daysUntilMilestone = config.milestoneDays - (currentStreak % config.milestoneDays);

  return {
    currentStreak,
    longestStreak: state?.longestStreak || 0,
    lastCheckInDay: state?.lastCheckInDay || null,
    checkedInToday,
    canCheckIn: !checkedInToday,
    dayKey: today,
    week,
    milestone: {
      days: config.milestoneDays,
      rewardVES: config.milestoneRewardVES,
      daysUntil: daysUntilMilestone,
      progress: currentStreak % config.milestoneDays
    }
  };
}

export async function checkInForStreak({ userId, ip }) {
  const config = await loadConfig();
  const now = new Date();
  const today = streakDayKey(now, config.timeZone);
  let outcome;

  try {
    outcome = await withTransaction(async session => {
      const alreadyRecorded = await DailyCheckIn.exists({ userId, dayKey: today }).session(session);
      if (alreadyRecorded) return { alreadyCheckedIn: true, rewardGrantedVES: 0 };

      const prior = await UserStreak.findOne({ userId }).session(session).lean();
      const priorDayDistance = prior?.lastCheckInDay ? dayDistance(today, prior.lastCheckInDay) : Infinity;
      const currentStreak = priorDayDistance === 1 ? prior.currentStreak + 1 : 1;
      const longestStreak = Math.max(prior?.longestStreak || 0, currentStreak);
      const earnsMilestone = config.active && currentStreak % config.milestoneDays === 0;
      const rewardGrantedVES = earnsMilestone ? config.milestoneRewardVES : 0;
      const checkInId = `checkin_${crypto.randomUUID()}`;

      await DailyCheckIn.create([{
        checkInId, userId, dayKey: today, streakDay: currentStreak, bonusVES: rewardGrantedVES
      }], { session });
      await UserStreak.findOneAndUpdate({ userId }, {
        $set: { currentStreak, longestStreak, lastCheckInDay: today, lastCheckInAt: now },
        $setOnInsert: { userId }
      }, { upsert: true, new: true, session, runValidators: true });

      if (rewardGrantedVES > 0) {
        await creditWallet({
          userId,
          currency: "VES",
          amount: rewardGrantedVES,
          type: "DAILY_REWARD",
          source: "STREAK_MILESTONE",
          referenceId: checkInId,
          description: `${config.milestoneDays}-day streak milestone reward`,
          metadata: { checkInId, streakDay: currentStreak, milestoneDays: config.milestoneDays },
          session
        });
      }

      await AuditLog.create([{
        actorId: userId,
        targetUserId: userId,
        targetType: "USER_STREAK",
        action: "STREAK_CHECK_IN",
        referenceId: checkInId,
        ip,
        metadata: { dayKey: today, streakDay: currentStreak, rewardGrantedVES }
      }], { session });

      return { alreadyCheckedIn: false, rewardGrantedVES, currentStreak };
    });
  } catch (error) {
    // The unique user/day index closes the race between simultaneous requests.
    if (error?.code !== 11000) throw error;
    outcome = { alreadyCheckedIn: true, rewardGrantedVES: 0 };
  }

  return { ...outcome, streak: await getStreak(userId) };
}
