import RazorpayTestPayout from "../models/RazorpayTestPayout.js";
import { httpError } from "../utils/httpError.js";
import { razorpayTestConfiguration, submitRazorpayTestPayout, reconcileRazorpayTestPayout, verifyRazorpayTestWebhook } from "../services/razorpayTestPayoutService.js";

export function configuration(_req, res) { res.json({ success: true, integration: razorpayTestConfiguration() }); }

export async function submit(req, res, next) {
  try { res.json({ success: true, mode: "TEST", ...(await submitRazorpayTestPayout({ withdrawalId: req.params.id, actorId: req.user._id, ip: req.ip })) }); }
  catch (error) { next(error); }
}

export async function reconcile(req, res, next) {
  try { res.json({ success: true, mode: "TEST", withdrawal: await reconcileRazorpayTestPayout({ withdrawalId: req.params.id, actorId: req.user._id, ip: req.ip }) }); }
  catch (error) { next(error); }
}

export async function webhook(req, res, next) {
  try {
    if (!verifyRazorpayTestWebhook(req.body, req.get("x-razorpay-signature"))) throw httpError("Invalid webhook signature.", 401);
    let event;
    try { event = JSON.parse(req.body.toString("utf8")); }
    catch { throw httpError("Invalid webhook body.", 400); }
    const payout = event.payload?.payout?.entity;
    if (!event.event?.startsWith("payout.") || !payout?.reference_id || !/^pout_[A-Za-z0-9]+$/.test(payout.id || "")) {
      return res.json({ success: true, ignored: true });
    }
    if (!(await RazorpayTestPayout.exists({ _id: payout.reference_id }))) return res.json({ success: true, ignored: true });
    // Fetch the latest authenticated provider state so delayed webhook events cannot regress it.
    await reconcileRazorpayTestPayout({ withdrawalId: payout.reference_id, verifiedPayoutId: payout.id });
    res.json({ success: true });
  } catch (error) { next(error); }
}
