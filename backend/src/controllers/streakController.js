import { checkInForStreak, getStreak } from "../services/streakService.js";

export async function streak(req, res, next) {
  try {
    res.json({ success: true, streak: await getStreak(req.user._id) });
  } catch (error) { next(error); }
}

export async function checkIn(req, res, next) {
  try {
    const result = await checkInForStreak({ userId: req.user._id, ip: req.ip });
    res.status(result.alreadyCheckedIn ? 200 : 201).json({ success: true, ...result });
  } catch (error) { next(error); }
}
