import crypto from "crypto";
import Withdrawal from "../models/Withdrawal.js";
import PayoutOption from "../models/PayoutOption.js";
import User from "../models/User.js";
import AuditLog from "../models/AuditLog.js";
import { debitWallet, creditWallet, withTransaction } from "./walletService.js";
import { decryptPayoutDetails, encryptPayoutDetails } from "../utils/encryption.js";
import { httpError } from "../utils/httpError.js";

const UPI_ID_PATTERN = /^[\w.\-]{2,}@[A-Za-z0-9.\-]{2,}$/;

function makeWithdrawalId() {
  return `wd_${crypto.randomUUID()}`;
}

function normalizeDetails(option, input) {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    throw httpError("Payout details are required.", 400);
  }
  const definitions = option.requiredDetails || [];
  const allowed = new Set(definitions.map(({ key }) => key));
  if (Object.keys(input).some(key => !allowed.has(key))) {
    throw httpError("Unexpected payout detail field.", 400);
  }

  const details = {};
  for (const field of definitions) {
    const value = input[field.key];
    if (field.required && (typeof value !== "string" || !value.trim())) {
      throw httpError(`Valid ${field.label} is required.`, 400);
    }
    if (value === undefined || value === null || value === "") continue;
    if (typeof value !== "string" || value.length > 254) throw httpError(`Invalid ${field.label}.`, 400);
    const normalized = value.trim();
    if (field.inputType === "email" && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)) {
      throw httpError(`Invalid ${field.label}.`, 400);
    }
    if (field.key === "upiId" && !UPI_ID_PATTERN.test(normalized)) throw httpError("Invalid UPI ID.", 400);
    details[field.key] = normalized;
  }
  return details;
}

function hashRequest({ method, optionId, payoutDetails }) {
  const canonical = JSON.stringify({
    method, optionId,
    payoutDetails: Object.fromEntries(Object.entries(payoutDetails).sort(([a], [b]) => a.localeCompare(b)))
  });
  const key = crypto.createHash("sha256").update(`${process.env.PAYOUT_DETAILS_ENCRYPTION_KEY}:idempotency-v1`).digest();
  return crypto.createHmac("sha256", key).update(canonical).digest("hex");
}

export function publicWithdrawal(withdrawal) {
  if (!withdrawal) return withdrawal;
  const value = typeof withdrawal.toObject === "function" ? withdrawal.toObject() : { ...withdrawal };
  delete value.payoutDetails;
  delete value.payoutDetailsEncrypted;
  delete value.requestHash;
  delete value.idempotencyKey;
  return value;
}

function adminWithdrawal(withdrawal) {
  const value = publicWithdrawal(withdrawal);
  const encrypted = withdrawal.payoutDetailsEncrypted;
  value.payoutDetails = decryptPayoutDetails(encrypted);
  return value;
}

async function findDuplicate(userId, idempotencyKey, requestHash) {
  const existing = await Withdrawal.findOne({ userId, idempotencyKey }).select("+requestHash");
  if (!existing) return null;
  if (existing.requestHash !== requestHash) {
    throw httpError("This Idempotency-Key was already used for a different request.", 409);
  }
  return existing;
}

function assertEligible(user, option) {
  if (!user || user.accountStatus !== "ACTIVE") throw httpError("Account is not eligible for payouts.", 403);
  const eligibility = option.eligibility || {};
  if (eligibility.accountStatus && eligibility.accountStatus !== user.accountStatus) {
    throw httpError("Account is not eligible for this payout option.", 403);
  }
  if (eligibility.minAccountAgeDays) {
    const ageDays = (Date.now() - user.createdAt.getTime()) / 86400000;
    if (ageDays < eligibility.minAccountAgeDays) throw httpError("Account is not eligible for this payout option.", 403);
  }
}

export async function createWithdrawal({ userId, method, optionId, payoutDetails, idempotencyKey, ip }) {
  if (typeof idempotencyKey !== "string" || idempotencyKey.length < 8 || idempotencyKey.length > 100) {
    throw httpError("A valid Idempotency-Key header is required.", 400);
  }
  const option = await PayoutOption.findOne({ method, methodId: optionId, active: true }).lean();
  if (!option) throw httpError("Selected payout option is unavailable.", 400);
  const user = await User.findById(userId).select("accountStatus createdAt").lean();
  assertEligible(user, option);
  const details = normalizeDetails(option, payoutDetails);
  const requestHash = hashRequest({ method, optionId, payoutDetails: details });
  const duplicate = await findDuplicate(userId, idempotencyKey, requestHash);
  if (duplicate) return { duplicate: true, withdrawal: publicWithdrawal(duplicate) };

  const withdrawalId = makeWithdrawalId();
  try {
    const withdrawal = await withTransaction(async session => {
      const { ledger } = await debitWallet({
        userId, currency: option.currency, amount: option.requiredAmount,
        type: "WITHDRAWAL", source: "WITHDRAWAL", referenceId: withdrawalId,
        description: `${option.name} withdrawal`,
        metadata: { method, optionId, payoutValue: option.payoutValue }, session
      });
      const [created] = await Withdrawal.create([{
        withdrawalId, userId, method, optionId,
        currency: option.currency, currencyAmount: option.requiredAmount,
        payoutAmount: option.payoutValue, payoutCurrency: option.payoutCurrency,
        payoutDetailsEncrypted: encryptPayoutDetails(details),
        requestHash, status: "PENDING", transactionId: ledger.transactionId, idempotencyKey
      }], { session });
      await AuditLog.create([{
        actorId: userId, targetUserId: userId, action: "WITHDRAWAL_CREATED",
        targetType: "Withdrawal", referenceId: withdrawalId,
        metadata: { method, optionId, payoutAmount: option.payoutValue }, ip
      }], { session });
      return created;
    });
    return { duplicate: false, withdrawal: publicWithdrawal(withdrawal) };
  } catch (error) {
    if (error?.code === 11000) {
      const racedDuplicate = await findDuplicate(userId, idempotencyKey, requestHash);
      if (racedDuplicate) return { duplicate: true, withdrawal: publicWithdrawal(racedDuplicate) };
    }
    throw error;
  }
}

export async function listWithdrawals(userId, page = 1, limit = 20) {
  const currentPage = Math.max(1, Number(page) || 1);
  const pageSize = Math.min(100, Math.max(1, Number(limit) || 20));
  const [items, total] = await Promise.all([
    Withdrawal.find({ userId }).sort({ createdAt: -1, _id: -1 })
      .skip((currentPage - 1) * pageSize).limit(pageSize).lean(),
    Withdrawal.countDocuments({ userId })
  ]);
  return { items: items.map(publicWithdrawal), page: currentPage, limit: pageSize, total, pages: Math.ceil(total / pageSize) };
}

export async function getWithdrawal(userId, id) {
  const item = await Withdrawal.findOne({ withdrawalId: id, userId }).lean();
  if (!item) throw httpError("Withdrawal not found.", 404);
  return publicWithdrawal(item);
}

export async function listAdminWithdrawals({ status, page = 1, limit = 20 }) {
  const currentPage = Math.max(1, Number(page) || 1);
  const pageSize = Math.min(100, Math.max(1, Number(limit) || 20));
  const filter = status ? { status } : {};
  const [items, total] = await Promise.all([
    Withdrawal.find(filter).select("+payoutDetailsEncrypted").sort({ requestedAt: 1, _id: 1 })
      .skip((currentPage - 1) * pageSize).limit(pageSize).lean(),
    Withdrawal.countDocuments(filter)
  ]);
  return { items: items.map(adminWithdrawal), page: currentPage, limit: pageSize, total, pages: Math.ceil(total / pageSize) };
}

export async function getAdminWithdrawal(withdrawalId) {
  const item = await Withdrawal.findOne({ withdrawalId }).select("+payoutDetailsEncrypted").lean();
  if (!item) throw httpError("Withdrawal not found.", 404);
  return adminWithdrawal(item);
}

export async function transitionWithdrawal({ actorId, withdrawalId, nextStatus, reason, note, ip, userId }) {
  return withTransaction(async session => {
    const allowedFrom = {
      PROCESSING: ["PENDING"], APPROVED: ["PROCESSING"],
      REJECTED: ["PENDING", "PROCESSING"], CANCELLED: ["PENDING"]
    };
    const filter = {
      withdrawalId, status: { $in: allowedFrom[nextStatus] || [] },
      ...(userId ? { userId } : {})
    };
    const withdrawal = await Withdrawal.findOne(filter).session(session);
    if (!withdrawal) throw httpError("Withdrawal not found or cannot move to that status.", 409);

    let reversalTransactionId;
    if (["REJECTED", "CANCELLED"].includes(nextStatus)) {
      const { ledger } = await creditWallet({
        userId: withdrawal.userId, currency: withdrawal.currency,
        amount: withdrawal.currencyAmount, type: "WITHDRAWAL_REVERSAL",
        source: nextStatus === "REJECTED" ? "WITHDRAWAL_REJECTION" : "WITHDRAWAL_CANCELLATION",
        referenceId: withdrawal.withdrawalId,
        description: `Withdrawal ${nextStatus.toLowerCase()} reversal`,
        metadata: { reason }, session
      });
      reversalTransactionId = ledger.transactionId;
    }

    const previousStatus = withdrawal.status;
    withdrawal.status = nextStatus;
    if (nextStatus === "REJECTED") withdrawal.rejectionReason = reason || "Rejected by administrator.";
    if (note) withdrawal.reviewNote = note;
    if (["APPROVED", "REJECTED", "CANCELLED"].includes(nextStatus)) withdrawal.processedAt = new Date();
    await withdrawal.save({ session });
    await AuditLog.create([{
      actorId, targetUserId: withdrawal.userId,
      action: `WITHDRAWAL_${nextStatus}`, targetType: "Withdrawal",
      referenceId: withdrawal.withdrawalId,
      metadata: { fromStatus: previousStatus, toStatus: nextStatus, reason, reversalTransactionId }, ip
    }], { session });
    return publicWithdrawal(withdrawal);
  });
}


