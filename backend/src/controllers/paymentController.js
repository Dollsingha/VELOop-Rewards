import crypto from "node:crypto";
import Razorpay from "razorpay";
import PurchaseOrder from "../models/PurchaseOrder.js";
import AuditLog from "../models/AuditLog.js";
import { creditWallet, withTransaction } from "../services/walletService.js";
import { httpError } from "../utils/httpError.js";

const fingerprint = () => crypto.createHash("sha256").update(process.env.RAZORPAY_KEY_ID || "").digest("hex");
function ready() {
  return /^rzp_test_[A-Za-z0-9]+$/.test(process.env.RAZORPAY_KEY_ID || "") && Boolean(process.env.RAZORPAY_KEY_SECRET?.trim());
}
function razorpayClient() {
  if (!ready()) throw httpError("Test payments are temporarily unavailable. The project owner must configure Razorpay Checkout test keys.", 503);
  return new Razorpay({ key_id: process.env.RAZORPAY_KEY_ID, key_secret: process.env.RAZORPAY_KEY_SECRET });
}
async function providerCall(callback) {
  try { return await callback(); }
  catch { throw httpError("The payment provider could not be reached. Check the existing payment status before starting another payment.", 502); }
}
function purchasePackages() {
  let packages;
  try { packages = JSON.parse(process.env.VES_PURCHASE_PACKAGES || "[]"); }
  catch { throw httpError("Purchase packages are temporarily unavailable.", 503); }
  if (!Array.isArray(packages)) throw httpError("Purchase packages are temporarily unavailable.", 503);
  const ids = new Set();
  for (const item of packages) {
    if (!item || typeof item.id !== "string" || !/^[A-Za-z0-9_-]{1,80}$/.test(item.id) ||
        typeof item.label !== "string" || !item.label.trim() || item.label.length > 120 ||
        !Number.isSafeInteger(item.ves) || item.ves <= 0 ||
        !Number.isSafeInteger(item.amountPaise) || item.amountPaise < 100 || ids.has(item.id)) {
      throw httpError("Purchase packages are temporarily unavailable.", 503);
    }
    ids.add(item.id);
  }
  return packages;
}
function publicOrder(order) {
  return { id: order.razorpayOrderId, amount: order.amountPaise, currency: order.currency,
    ves: order.vesAmount, packageId: order.packageId, status: order.status, createdAt: order.createdAt };
}
async function ownedOrder(userId, orderId) {
  if (!/^order_[A-Za-z0-9]+$/.test(orderId || "")) throw httpError("Invalid payment order.", 400);
  const purchase = await PurchaseOrder.findOne({ razorpayOrderId: orderId, userId }).select("+keyFingerprint");
  if (!purchase) throw httpError("Payment order not found for this account.", 404);
  if (purchase.keyFingerprint && purchase.keyFingerprint !== fingerprint()) {
    throw httpError("This order belongs to a different test account. Contact the project owner before retrying.", 409);
  }
  return purchase;
}
async function creditCaptured(purchase, payment, actorId, ip) {
  if (!/^pay_[A-Za-z0-9]+$/.test(payment?.id || "") ||
      payment.order_id !== purchase.razorpayOrderId || payment.amount !== purchase.amountPaise ||
      payment.currency !== purchase.currency || payment.status !== "captured" || (payment.amount_refunded || 0) !== 0) {
    throw httpError("Payment is not confirmed as captured. No VEs have been added. Check payment status before paying again.", 409);
  }
  const result = await withTransaction(async session => {
    const current = await PurchaseOrder.findById(purchase._id).session(session);
    if (!current) throw httpError("Payment order not found.", 404);
    if (current.status === "PAID") return { alreadyCredited: true };
    if (current.status !== "CREATED") throw httpError("This payment order cannot be credited.", 409);
    current.status = "PAID";
    current.razorpayPaymentId = payment.id;
    current.creditedAt = new Date();
    await current.save({ session });
    const { ledger } = await creditWallet({
      userId: current.userId, currency: "VES", amount: current.vesAmount,
      type: "PURCHASE_CREDIT", source: "RAZORPAY", referenceId: payment.id,
      description: `Purchased ${current.vesAmount} VEs (test payment)`,
      metadata: { orderId: current.razorpayOrderId, packageId: current.packageId, amountPaise: current.amountPaise, mode: "TEST" }, session
    });
    await AuditLog.create([{
      actorId, targetUserId: current.userId, action: "PURCHASE_CREDITED",
      targetType: "PurchaseOrder", referenceId: current.razorpayOrderId, ip,
      metadata: { paymentId: payment.id, transactionId: ledger.transactionId, ves: current.vesAmount, mode: "TEST" }
    }], { session });
    return { alreadyCredited: false };
  });
  return { success: true, ...result, message: result.alreadyCredited ? "This payment has already been credited." : `${purchase.vesAmount} VEs added to your wallet.`, vesCredited: result.alreadyCredited ? 0 : purchase.vesAmount };
}
export async function listPackages(_req, res, next) {
  try {
    const packages = purchasePackages().map(({ id, label, ves, amountPaise }) => ({ id, label, ves, amountPaise, amountRupees: amountPaise / 100, currency: "INR" }));
    res.json({ success: true, packages, checkoutReady: ready() && packages.length > 0, mode: "TEST" });
  } catch (error) { next(error); }
}
export async function listOrders(req, res, next) {
  try {
    const orders = await PurchaseOrder.find({ userId: req.user._id }).sort({ createdAt: -1 }).limit(10).lean();
    res.json({ success: true, orders: orders.map(publicOrder) });
  } catch (error) { next(error); }
}
export async function createPaymentOrder(req, res, next) {
  try {
    const selected = purchasePackages().find(item => item.id === req.body?.packageId);
    if (!selected) throw httpError("Choose an available VEs package.", 400);
    const razorpay = razorpayClient();
    const receipt = `ves_${crypto.randomUUID().replaceAll("-", "").slice(0, 32)}`;
    const order = await providerCall(() => razorpay.orders.create({
      amount: selected.amountPaise, currency: "INR", receipt,
      notes: { userId: String(req.user._id), packageId: selected.id }
    }));
    if (!/^order_[A-Za-z0-9]+$/.test(order?.id || "") || order.amount !== selected.amountPaise || order.currency !== "INR") {
      throw httpError("The payment order could not be validated. No payment has been started.", 502);
    }
    const purchase = await PurchaseOrder.create({
      userId: req.user._id, packageId: selected.id, vesAmount: selected.ves,
      amountPaise: selected.amountPaise, currency: "INR", razorpayOrderId: order.id,
      keyFingerprint: fingerprint(), status: "CREATED"
    });
    res.status(201).json({ success: true, order: { ...publicOrder(purchase), packageLabel: selected.label }, keyId: process.env.RAZORPAY_KEY_ID, mode: "TEST" });
  } catch (error) { next(error); }
}
export async function verifyPayment(req, res, next) {
  try {
    const { razorpay_order_id: orderId, razorpay_payment_id: paymentId, razorpay_signature: signature } = req.body || {};
    if (!/^pay_[A-Za-z0-9]+$/.test(paymentId || "") || !/^[a-f0-9]{64}$/i.test(signature || "")) {
      throw httpError("Invalid payment verification details.", 400);
    }
    const razorpay = razorpayClient();
    const purchase = await ownedOrder(req.user._id, orderId);
    const expected = crypto.createHmac("sha256", process.env.RAZORPAY_KEY_SECRET).update(`${purchase.razorpayOrderId}|${paymentId}`).digest();
    if (!crypto.timingSafeEqual(expected, Buffer.from(signature, "hex"))) throw httpError("Payment signature could not be verified. No VEs were added.", 400);
    const payment = await providerCall(() => razorpay.payments.fetch(paymentId));
    res.json(await creditCaptured(purchase, payment, req.user._id, req.ip));
  } catch (error) { next(error); }
}
export async function reconcilePayment(req, res, next) {
  try {
    const razorpay = razorpayClient();
    const purchase = await ownedOrder(req.user._id, req.params.id);
    const result = await providerCall(() => razorpay.orders.fetchPayments(purchase.razorpayOrderId));
    const captured = (result.items || []).filter(payment => payment.status === "captured");
    if (captured.length !== 1) throw httpError("No single captured payment has been confirmed for this order. No VEs were added. Check Razorpay test status before making another payment.", 409);
    res.json(await creditCaptured(purchase, captured[0], req.user._id, req.ip));
  } catch (error) { next(error); }
}
