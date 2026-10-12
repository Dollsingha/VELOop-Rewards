import crypto from "node:crypto";
import Withdrawal from "../models/Withdrawal.js";
import RazorpayTestPayout from "../models/RazorpayTestPayout.js";
import AuditLog from "../models/AuditLog.js";
import { decryptPayoutDetails } from "../utils/encryption.js";
import { httpError } from "../utils/httpError.js";
import { creditWallet, withTransaction } from "./walletService.js";
import { publicWithdrawal } from "./withdrawalService.js";

const API_BASE = "https://api.razorpay.com/v1";
const FAILED = new Set(["failed", "rejected", "cancelled", "reversed"]);
const PAYOUT_STATUSES = new Set(["queued", "pending", "processing", "processed", ...FAILED]);
const fingerprint = key => crypto.createHash("sha256").update(key).digest("hex");

export function razorpayTestConfiguration() {
  const required = ["RAZORPAYX_TEST_KEY_ID", "RAZORPAYX_TEST_KEY_SECRET", "RAZORPAYX_TEST_ACCOUNT_NUMBER", "RAZORPAYX_TEST_WEBHOOK_SECRET"];
  const missing = required.filter(key => !process.env[key]?.trim());
  const enabled = process.env.RAZORPAYX_TEST_ENABLED === "true";
  const testKey = /^rzp_test_[A-Za-z0-9]+$/.test(process.env.RAZORPAYX_TEST_KEY_ID || "");
  return { provider: "RAZORPAYX", mode: "TEST", enabled, ready: enabled && missing.length === 0 && testKey, missing, testKey };
}

function config() {
  if (!razorpayTestConfiguration().ready) throw httpError("RazorpayX test payouts are not configured. An administrator must add the test keys, test account identifier, and webhook secret.", 503);
  return {
    keyId: process.env.RAZORPAYX_TEST_KEY_ID,
    keySecret: process.env.RAZORPAYX_TEST_KEY_SECRET,
    accountNumber: process.env.RAZORPAYX_TEST_ACCOUNT_NUMBER
  };
}

async function requestProvider(settings, route, { body, idempotencyKey } = {}) {
  let response;
  try {
    response = await fetch(`${API_BASE}${route}`, {
      method: body ? "POST" : "GET",
      headers: {
        Authorization: `Basic ${Buffer.from(`${settings.keyId}:${settings.keySecret}`).toString("base64")}`,
        "Content-Type": "application/json",
        ...(idempotencyKey ? { "X-Payout-Idempotency": idempotencyKey } : {})
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
      signal: AbortSignal.timeout(15000)
    });
  } catch {
    throw httpError("RazorpayX test payout could not be confirmed. The request remains reserved for reconciliation; do not create another withdrawal.", 502);
  }
  if (!response.ok) throw httpError("RazorpayX test payout requires administrator review. Check the test account configuration and reconcile the request before retrying.", 502);
  try { return await response.json(); }
  catch { throw httpError("RazorpayX returned an unreadable test response. Reconciliation is required.", 502); }
}

function assertProviderPayout(attempt, payout) {
  if (!/^pout_[A-Za-z0-9]+$/.test(payout?.id || "") || payout.entity !== "payout" ||
      payout.reference_id !== attempt._id || payout.amount !== attempt.expectedAmount ||
      payout.currency !== "INR" || payout.mode !== "UPI" || !PAYOUT_STATUSES.has(payout.status) ||
      (attempt.payoutId && attempt.payoutId !== payout.id)) {
    throw httpError("RazorpayX test response did not match the stored withdrawal. Administrator review is required.", 502);
  }
}

async function settle(withdrawalId, payout, actorId, ip) {
  return withTransaction(async session => {
    const attempt = await RazorpayTestPayout.findById(withdrawalId).session(session);
    const withdrawal = await Withdrawal.findOne({ withdrawalId, payoutProvider: "RAZORPAYX_TEST" }).session(session);
    if (!attempt || !withdrawal) throw httpError("Test payout request not found.", 404);
    assertProviderPayout(attempt, payout);
    const previousStatus = withdrawal.status;
    let reversalTransactionId;
    if (payout.status === "processed" && withdrawal.status === "PROCESSING") {
      withdrawal.status = "APPROVED";
      withdrawal.processedAt = new Date();
    } else if (FAILED.has(payout.status) && (withdrawal.status === "PROCESSING" ||
        (withdrawal.status === "APPROVED" && payout.status === "reversed"))) {
      const { ledger } = await creditWallet({
        userId: withdrawal.userId, currency: withdrawal.currency, amount: withdrawal.currencyAmount,
        type: "WITHDRAWAL_REVERSAL", source: "RAZORPAYX_TEST_REVERSAL", referenceId: withdrawalId,
        description: "RazorpayX test payout failure reversal", metadata: { providerStatus: payout.status }, session
      });
      reversalTransactionId = ledger.transactionId;
      withdrawal.status = "REJECTED";
      withdrawal.rejectionReason = `RazorpayX test payout ${payout.status}.`;
      withdrawal.processedAt = new Date();
    }
    // Terminal application states cannot be undone by delayed notifications.
    if (!["REJECTED", "CANCELLED"].includes(previousStatus)) withdrawal.providerStatus = payout.status;
    attempt.state = "SUBMITTED";
    attempt.payoutId = payout.id;
    attempt.providerStatus = withdrawal.providerStatus || payout.status;
    await attempt.save({ session });
    await withdrawal.save({ session });
    if (previousStatus !== withdrawal.status) {
      await AuditLog.create([{
        actorId, targetUserId: withdrawal.userId, action: "RAZORPAYX_TEST_STATUS_CHANGED",
        targetType: "Withdrawal", referenceId: withdrawalId, ip,
        metadata: { payoutId: payout.id, providerStatus: payout.status, fromStatus: previousStatus, toStatus: withdrawal.status, reversalTransactionId }
      }], { session });
    }
    return publicWithdrawal(withdrawal);
  });
}

export async function submitRazorpayTestPayout({ withdrawalId, actorId, ip }) {
  const settings = config(); // Fail before changing wallet/request state if keys are missing or live.
  const claimed = await withTransaction(async session => {
    const withdrawal = await Withdrawal.findOne({ withdrawalId }).select("+payoutDetailsEncrypted").session(session);
    if (!withdrawal) throw httpError("Withdrawal not found.", 404);
    const existing = await RazorpayTestPayout.findById(withdrawalId).session(session);
    if (existing) {
      if (existing.state === "SUBMITTED") return { duplicate: true, withdrawal: publicWithdrawal(withdrawal) };
      throw httpError("This test payout is already submitting or awaiting reconciliation. Do not submit it again.", 409);
    }
    if (withdrawal.status !== "PENDING" || withdrawal.method !== "upi" || withdrawal.payoutCurrency !== "INR") {
      throw httpError("Only a pending INR UPI withdrawal can use RazorpayX test payouts.", 409);
    }
    const amount = withdrawal.payoutAmount * 100;
    if (!Number.isSafeInteger(amount) || amount < 100) throw httpError("Invalid configured payout amount.", 400);
    const details = decryptPayoutDetails(withdrawal.payoutDetailsEncrypted);
    if (!/^[A-Za-z0-9.\-]{2,}@[A-Za-z0-9.\-]{2,}$/.test(details.upiId || "") || details.upiId.length > 100) {
      throw httpError("This UPI ID is unsupported by the test payout provider.", 400);
    }
    const idempotencyKey = crypto.randomUUID();
    await RazorpayTestPayout.create([{
      _id: withdrawalId, state: "SUBMITTING", idempotencyKey,
      accountNumber: settings.accountNumber, keyFingerprint: fingerprint(settings.keyId), expectedAmount: amount
    }], { session });
    withdrawal.status = "PROCESSING";
    withdrawal.payoutProvider = "RAZORPAYX_TEST";
    withdrawal.providerStatus = "submitting";
    await withdrawal.save({ session });
    await AuditLog.create([{
      actorId, targetUserId: withdrawal.userId, action: "RAZORPAYX_TEST_SUBMITTED",
      targetType: "Withdrawal", referenceId: withdrawalId, ip, metadata: { mode: "TEST", amount, currency: "INR" }
    }], { session });
    return { idempotencyKey, amount, upiId: details.upiId };
  });
  if (claimed.duplicate) return claimed;
  try {
    const payout = await requestProvider(settings, "/payouts", {
      idempotencyKey: claimed.idempotencyKey,
      body: {
        account_number: settings.accountNumber, amount: claimed.amount, currency: "INR", mode: "UPI", purpose: "payout",
        fund_account: { account_type: "vpa", vpa: { address: claimed.upiId }, contact: { name: "VELOop Test Recipient", type: "customer", reference_id: withdrawalId } },
        queue_if_low_balance: false, reference_id: withdrawalId, narration: "VELOop Test Payout"
      }
    });
    return { duplicate: false, withdrawal: await settle(withdrawalId, payout, actorId, ip) };
  } catch (error) {
    await RazorpayTestPayout.updateOne({ _id: withdrawalId, state: "SUBMITTING" }, { $set: { state: "UNKNOWN" } });
    throw error;
  }
}

export async function reconcileRazorpayTestPayout({ withdrawalId, actorId, ip, verifiedPayoutId }) {
  const settings = config();
  const attempt = await RazorpayTestPayout.findById(withdrawalId).select("+accountNumber +keyFingerprint").lean();
  if (!attempt) throw httpError("Test payout request not found.", 404);
  if (attempt.keyFingerprint !== fingerprint(settings.keyId)) throw httpError("The RazorpayX test account changed. Restore its original test keys before reconciling this request.", 409);
  const payoutId = attempt.payoutId || verifiedPayoutId;
  let payout;
  if (payoutId) {
    if (!/^pout_[A-Za-z0-9]+$/.test(payoutId)) throw httpError("Invalid provider payout ID.", 400);
    payout = await requestProvider(settings, `/payouts/${payoutId}`);
  } else {
    const query = new URLSearchParams({ account_number: attempt.accountNumber, reference_id: withdrawalId, count: "100" });
    const found = await requestProvider(settings, `/payouts?${query}`);
    const matches = (found.items || []).filter(item => item.reference_id === withdrawalId);
    if (matches.length !== 1) throw httpError("The payout result is still uncertain. Check RazorpayX test dashboard; do not create a replacement withdrawal or manually refund it.", 409);
    payout = matches[0];
  }
  assertProviderPayout(attempt, payout);
  return settle(withdrawalId, payout, actorId, ip);
}

export function verifyRazorpayTestWebhook(rawBody, signature) {
  const secret = process.env.RAZORPAYX_TEST_WEBHOOK_SECRET;
  if (!secret || !Buffer.isBuffer(rawBody) || !/^[a-f0-9]{64}$/i.test(signature || "")) return false;
  const expected = crypto.createHmac("sha256", secret).update(rawBody).digest();
  return crypto.timingSafeEqual(expected, Buffer.from(signature, "hex"));
}
