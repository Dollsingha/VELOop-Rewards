import crypto from "node:crypto";
import DemoWallet from "../models/DemoWallet.js";
import DemoRewardClaim from "../models/DemoRewardClaim.js";
import AuditLog from "../models/AuditLog.js";
import { withTransaction } from "../services/walletService.js";
import { httpError } from "../utils/httpError.js";

// Illustrative, one-time demo grants. These are not VELOop production earning rules.
export const DEMO_STARTER = Object.freeze({ packId: "demo_starter_rewards_v1", sves: 100, gems: 10, tokens: 5, spins: 3 });
let ready;
async function ensureIndexes() {
  ready ||= Promise.all([DemoWallet.createIndexes(), DemoRewardClaim.createIndexes()]).catch(error => { ready = undefined; throw error; });
  await ready;
}
export async function claimStarter(req, res, next) {
  try {
    if (process.env.DEMO_PAYMENTS_ENABLED !== "true") throw httpError("Demo rewards are disabled.", 503);
    if (req.body && Object.keys(req.body).length) throw httpError("Demo reward amounts are configured by the server. Send an empty request body.", 400);
    await ensureIndexes();
    const existing = await DemoRewardClaim.findOne({ userId: req.user._id }).lean();
    if (existing) return res.json({ success: true, alreadyClaimed: true, claim: existing, mode: "DEMO" });
    try {
      await DemoWallet.updateOne({ userId: req.user._id }, { $setOnInsert: { userId: req.user._id } }, { upsert: true });
    } catch (error) { if (error.code !== 11000) throw error; }
    let claim;
    try {
      claim = await withTransaction(async session => {
        const wallet = await DemoWallet.findOneAndUpdate({ userId: req.user._id }, {
          $inc: { demoSves: DEMO_STARTER.sves, demoGems: DEMO_STARTER.gems, demoTokens: DEMO_STARTER.tokens, demoSpins: DEMO_STARTER.spins }
        }, { session, new: true, runValidators: true });
        if (!wallet) throw httpError("Demo wallet unavailable.", 404);
        const entries = [["SVES","demoSves","sves"],["GEMS","demoGems","gems"],["TOKENS","demoTokens","tokens"],["SPINS","demoSpins","spins"]].map(([currency,field,key]) => ({
          currency, amount: DEMO_STARTER[key], balanceBefore: wallet[field] - DEMO_STARTER[key], balanceAfter: wallet[field]
        }));
        const [created] = await DemoRewardClaim.create([{
          userId: req.user._id, claimId: "demo_reward_"+crypto.randomUUID(), packId: DEMO_STARTER.packId, entries, mode: "DEMO"
        }], { session });
        await AuditLog.create([{
          actorId: req.user._id, targetUserId: req.user._id, action: "DEMO_STARTER_REWARDS_CLAIMED",
          targetType: "DemoRewardClaim", referenceId: created.claimId, ip: req.ip,
          metadata: { mode: "DEMO", entries }
        }], { session });
        return created;
      });
    } catch (error) {
      if (error.code !== 11000) throw error;
      const previous = await DemoRewardClaim.findOne({ userId: req.user._id }).lean();
      if (!previous) throw error;
      return res.json({ success: true, alreadyClaimed: true, claim: previous, mode: "DEMO" });
    }
    res.status(201).json({ success: true, alreadyClaimed: false, claim, mode: "DEMO" });
  } catch (error) { next(error); }
}
