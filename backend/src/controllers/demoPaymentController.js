import crypto from "node:crypto";
import DemoWallet from "../models/DemoWallet.js";
import DemoRewardClaim from "../models/DemoRewardClaim.js";
import { DEMO_STARTER } from "./demoRewardController.js";
import DemoPayment from "../models/DemoPayment.js";
import AuditLog from "../models/AuditLog.js";
import { DEMO_PACKAGES } from "../config/demoPackages.js";
import { withTransaction } from "../services/walletService.js";
import { httpError } from "../utils/httpError.js";

let indexesReady;
async function ensureDemoIndexes() {
  indexesReady ||= Promise.all([DemoWallet.createIndexes(), DemoPayment.createIndexes()]).catch(error => { indexesReady = undefined; throw error; });
  await indexesReady;
}
function enabled() { return process.env.DEMO_PAYMENTS_ENABLED === "true"; }
function publicReceipt(item) {
  const result = item.toObject ? item.toObject() : { ...item };
  delete result.idempotencyKey;
  delete result.requestHash;
  return result;
}
export async function overview(req, res, next) {
  try {
    const [wallet, receipts] = await Promise.all([
      DemoWallet.findOne({ userId: req.user._id }).lean(),
      DemoPayment.find({ userId: req.user._id }).sort({ createdAt: -1 }).limit(20).lean()
    ]);
    const rewardClaim = await DemoRewardClaim.findOne({ userId: req.user._id }).lean();
    res.json({ rewardClaim, starterRewards: DEMO_STARTER, rewardBalances: { sves: wallet?.demoSves || 0, gems: wallet?.demoGems || 0, tokens: wallet?.demoTokens || 0, spins: wallet?.demoSpins || 0 }, success: true, enabled: enabled(), mode: "DEMO", demoVes: wallet?.demoVes || 0,
      packages: enabled() ? DEMO_PACKAGES : [], receipts: receipts.map(publicReceipt),
      message: "Simulation only. No money moves. Demo VEs cannot be withdrawn, transferred or converted to real rewards." });
  } catch (error) { next(error); }
}
export async function simulate(req, res, next) {
  try {
    if (!enabled()) throw httpError("Demo payments are disabled.", 503);
    const { packageId, outcome } = req.body || {};
    if (!["SUCCESS", "FAILURE"].includes(outcome)) throw httpError("Choose a valid demo outcome.", 400);
    const selected = DEMO_PACKAGES.find(item => item.id === packageId);
    if (!selected) throw httpError("Choose an available demo package.", 400);
    const key = req.get("Idempotency-Key");
    if (!/^[A-Za-z0-9-]{8,100}$/.test(key || "")) throw httpError("A valid Idempotency-Key is required.", 400);
    const requestHash = crypto.createHash("sha256").update(JSON.stringify({ packageId, outcome })).digest("hex");
    const filter = { userId: req.user._id, idempotencyKey: key };
    async function duplicate() {
      const receipt = await DemoPayment.findOne(filter).select("+requestHash");
      if (!receipt) return null;
      if (receipt.requestHash !== requestHash) throw httpError("This request key was already used for another simulation.", 409);
      return receipt;
    }
    await ensureDemoIndexes();
    const existing = await duplicate();
    if (existing) return res.json({ success: true, duplicate: true, receipt: publicReceipt(existing), mode: "DEMO" });
    // Initialize only the isolated demo balance; the redeemable Wallet is never mutated.
    try {
      await DemoWallet.updateOne({ userId: req.user._id }, { $setOnInsert: { userId: req.user._id, demoVes: 0 } }, { upsert: true });
    } catch (error) { if (error?.code !== 11000) throw error; }
    const receiptId = `demo_${crypto.randomUUID()}`;
    let receipt;
    try {
      receipt = await withTransaction(async session => {
        const amount = outcome === "SUCCESS" ? selected.ves : 0;
        const wallet = amount ? await DemoWallet.findOneAndUpdate(
          { userId: req.user._id, demoVes: { $lte: 100000 - amount } },
          { $inc: { demoVes: amount } }, { new: true, session, runValidators: true }
        ) : await DemoWallet.findOne({ userId: req.user._id }).session(session);
        if (!wallet) throw httpError("Demo balance limit reached (100,000 demo VEs).", 409);
        const [created] = await DemoPayment.create([{
          ...filter, receiptId, requestHash, packageId, mode: "DEMO",
          status: outcome === "SUCCESS" ? "SIMULATED_SUCCESS" : "SIMULATED_FAILURE",
          amount, balanceBefore: wallet.demoVes - amount, balanceAfter: wallet.demoVes,
          simulatedPricePaise: selected.amountPaise
        }], { session });
        await AuditLog.create([{
          actorId: req.user._id, targetUserId: req.user._id, action: "DEMO_PAYMENT_SIMULATED",
          targetType: "DemoPayment", referenceId: receiptId, ip: req.ip,
          metadata: { mode: "DEMO", outcome, amount, balanceBefore: created.balanceBefore, balanceAfter: created.balanceAfter }
        }], { session });
        return created;
      });
    } catch (error) {
      if (error?.code !== 11000) throw error;
      receipt = await duplicate();
      if (!receipt) throw error;
      return res.json({ success: true, duplicate: true, receipt: publicReceipt(receipt), mode: "DEMO" });
    }
    res.status(201).json({ success: true, duplicate: false, receipt: publicReceipt(receipt), mode: "DEMO" });
  } catch (error) { next(error); }
}
