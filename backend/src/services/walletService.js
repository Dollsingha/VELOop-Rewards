import crypto from "crypto";
import mongoose from "mongoose";
import Wallet from "../models/Wallet.js";
import WalletTransaction from "../models/WalletTransaction.js";
import { httpError } from "../utils/httpError.js";

const fieldMap = Object.freeze({ VES: "ves", SVES: "sves", GEMS: "gems", TOKENS: "tokens", SPINS: "spins" });

export function transactionId() {
  return `txn_${crypto.randomUUID()}`;
}

function walletField(currency) {
  const field = fieldMap[currency];
  if (!field) throw httpError("Invalid currency.", 400);
  return field;
}

function validateAmount(amount, direction) {
  if (!Number.isSafeInteger(amount) || amount <= 0) {
    throw httpError(`Invalid ${direction} amount. Use a positive whole number.`, 400);
  }
}

async function walletExists(userId, session) {
  const query = Wallet.exists({ userId });
  if (session) query.session(session);
  return query;
}

export async function getWallet(userId) {
  const wallet = await Wallet.findOne({ userId }).lean();
  if (!wallet) throw httpError("Wallet not found.", 404);
  return wallet;
}

export async function getTransactions(userId, page = 1, limit = 20) {
  const currentPage = Math.max(1, Number(page) || 1);
  const pageSize = Math.min(100, Math.max(1, Number(limit) || 20));
  const filter = { userId };
  const [items, total] = await Promise.all([
    WalletTransaction.find(filter).sort({ createdAt: -1, _id: -1 })
      .skip((currentPage - 1) * pageSize).limit(pageSize).lean(),
    WalletTransaction.countDocuments(filter)
  ]);
  return { items, page: currentPage, limit: pageSize, total, pages: Math.ceil(total / pageSize) };
}

export async function creditWallet({
  userId, currency = "VES", amount, type = "REWARD", source = "SYSTEM",
  referenceId, description, metadata, session
}) {
  validateAmount(amount, "credit");
  const field = walletField(currency);
  const wallet = await Wallet.findOneAndUpdate(
    { userId, [field]: { $lte: Number.MAX_SAFE_INTEGER - amount } },
    { $inc: { [field]: amount } },
    { new: true, session, runValidators: true }
  );
  if (!wallet) {
    if (!(await walletExists(userId, session))) throw httpError("Wallet not found.", 404);
    throw httpError("Wallet balance exceeds the supported range.", 400);
  }

  const [ledger] = await WalletTransaction.create([{
    transactionId: transactionId(), userId, currency, type, amount,
    balanceBefore: wallet[field] - amount, balanceAfter: wallet[field],
    direction: "CREDIT", source, referenceId, description, metadata
  }], { session });
  return { wallet, ledger };
}

export async function debitWallet({
  userId, currency = "VES", amount, type = "WITHDRAWAL", source = "WITHDRAWAL",
  referenceId, description, metadata, session
}) {
  validateAmount(amount, "debit");
  const field = walletField(currency);
  const wallet = await Wallet.findOneAndUpdate(
    { userId, [field]: { $gte: amount } },
    { $inc: { [field]: -amount } },
    { new: true, session, runValidators: true }
  );

  if (!wallet) {
    if (!(await walletExists(userId, session))) throw httpError("Wallet not found.", 404);
    throw httpError(`Insufficient ${currency} balance.`, 400);
  }

  const [ledger] = await WalletTransaction.create([{
    transactionId: transactionId(), userId, currency, type, amount,
    balanceBefore: wallet[field] + amount, balanceAfter: wallet[field],
    direction: "DEBIT", source, referenceId, description, metadata
  }], { session });
  return { wallet, ledger };
}

export async function withTransaction(callback) {
  const session = await mongoose.startSession();
  try {
    let result;
    await session.withTransaction(async () => {
      result = await callback(session);
    }, {
      readPreference: "primary",
      readConcern: { level: "snapshot" },
      writeConcern: { w: "majority" }
    });
    return result;
  } finally {
    await session.endSession();
  }
}
