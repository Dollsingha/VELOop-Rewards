import crypto from "node:crypto";
import Razorpay from "razorpay";
import PurchaseOrder from "../models/PurchaseOrder.js";
import { creditWallet, withTransaction } from "../services/walletService.js";
import { httpError } from "../utils/httpError.js";

function razorpayClient() {
  const key_id = process.env.RAZORPAY_KEY_ID;
  const key_secret = process.env.RAZORPAY_KEY_SECRET;
  if (!key_id || !key_secret) {
    throw httpError("Payments are not configured yet. Add Razorpay test keys in the server environment.", 503);
  }
  return new Razorpay({ key_id, key_secret });
}

function purchasePackages() {
  let packages;
  try {
    packages = JSON.parse(process.env.VES_PURCHASE_PACKAGES || "[]");
  } catch {
    throw httpError("VES_PURCHASE_PACKAGES must be valid JSON.", 503);
  }
  if (!Array.isArray(packages)) throw httpError("VES_PURCHASE_PACKAGES must be a JSON array.", 503);
  return packages.filter(item =>
    item && typeof item.id === "string" && item.id.trim() &&
    typeof item.label === "string" && item.label.trim() &&
    Number.isSafeInteger(item.ves) && item.ves > 0 &&
    Number.isSafeInteger(item.amountPaise) && item.amountPaise >= 100
  );
}

export async function listPackages(_req, res, next) {
  try {
    const packages = purchasePackages().map(({ id, label, ves, amountPaise }) => ({
      id, label, ves, amountPaise, amountRupees: amountPaise / 100, currency: "INR"
    }));
    res.json({ success: true, packages });
  } catch (error) { next(error); }
}

export async function createPaymentOrder(req, res, next) {
  try {
    const { packageId } = req.body || {};
    if (typeof packageId !== "string" || !packageId.trim()) {
      throw httpError("Choose a valid VES package.", 400);
    }
    const selected = purchasePackages().find(item => item.id === packageId);
    if (!selected) throw httpError("This VES package is unavailable.", 400);

    const razorpay = razorpayClient();
    const receipt = `ves_${crypto.randomUUID().replaceAll("-", "").slice(0, 32)}`;
    const order = await razorpay.orders.create({
      amount: selected.amountPaise,
      currency: "INR",
      receipt,
      notes: { userId: String(req.user._id), packageId: selected.id }
    });

    await PurchaseOrder.create({
      userId: req.user._id,
      packageId: selected.id,
      vesAmount: selected.ves,
      amountPaise: selected.amountPaise,
      currency: "INR",
      razorpayOrderId: order.id,
      status: "CREATED"
    });

    res.status(201).json({
      success: true,
      order: {
        id: order.id,
        amount: order.amount,
        currency: order.currency,
        packageId: selected.id,
        packageLabel: selected.label,
        ves: selected.ves
      },
      keyId: process.env.RAZORPAY_KEY_ID
    });
  } catch (error) { next(error); }
}

export async function verifyPayment(req, res, next) {
  try {
    const { razorpay_order_id: orderId, razorpay_payment_id: paymentId, razorpay_signature: signature } = req.body || {};
    if (![orderId, paymentId, signature].every(value => typeof value === "string" && value.length > 0)) {
      throw httpError("Payment verification details are incomplete. Do not retry a payment until its status is checked.", 400);
    }

    const purchase = await PurchaseOrder.findOne({ razorpayOrderId: orderId, userId: req.user._id });
    if (!purchase) throw httpError("Payment order not found for this account.", 404);
    if (purchase.status === "PAID") {
      return res.json({ success: true, alreadyCredited: true, message: "This payment has already been credited." });
    }
    if (purchase.status !== "CREATED") throw httpError("This payment order is no longer payable.", 409);

    const secret = process.env.RAZORPAY_KEY_SECRET;
    const razorpay = razorpayClient();
    const expected = crypto.createHmac("sha256", secret).update(`${purchase.razorpayOrderId}|${paymentId}`).digest();
    let received;
    try { received = Buffer.from(signature, "hex"); } catch { received = Buffer.alloc(0); }
    if (received.length !== expected.length || !crypto.timingSafeEqual(received, expected)) {
      throw httpError("Payment signature could not be verified. No VES was added.", 400);
    }

    // Verify the payment with Razorpay itself; a browser callback alone is not proof of payment.
    const payment = await razorpay.payments.fetch(paymentId);
    if (payment.order_id !== purchase.razorpayOrderId ||
        payment.amount !== purchase.amountPaise ||
        payment.currency !== purchase.currency ||
        payment.status !== "captured") {
      throw httpError("Razorpay has not confirmed a captured payment for this order. No VES was added.", 409);
    }

    const result = await withTransaction(async session => {
      const current = await PurchaseOrder.findOne({ _id: purchase._id }).session(session);
      if (!current) throw httpError("Payment order not found.", 404);
      if (current.status === "PAID") return { alreadyCredited: true };
      if (current.status !== "CREATED") throw httpError("This payment order is no longer payable.", 409);

      current.status = "PAID";
      current.razorpayPaymentId = paymentId;
      current.creditedAt = new Date();
      await current.save({ session });

      await creditWallet({
        userId: current.userId,
        currency: "VES",
        amount: current.vesAmount,
        type: "PURCHASE_CREDIT",
        source: "RAZORPAY",
        referenceId: paymentId,
        description: `Purchased ${current.vesAmount} VES`,
        metadata: { orderId: current.razorpayOrderId, packageId: current.packageId, amountPaise: current.amountPaise },
        session
      });
      return { alreadyCredited: false };
    });

    res.json({
      success: true,
      alreadyCredited: result.alreadyCredited,
      message: result.alreadyCredited ? "This payment has already been credited." : `${purchase.vesAmount} VES added to your wallet.`,
      vesCredited: result.alreadyCredited ? 0 : purchase.vesAmount
    });
  } catch (error) { next(error); }
}
