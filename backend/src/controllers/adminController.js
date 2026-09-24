import User from "../models/User.js";
import Wallet from "../models/Wallet.js";
import AuditLog from "../models/AuditLog.js";
import Withdrawal from "../models/Withdrawal.js";
import PayoutOption from "../models/PayoutOption.js";
import { creditWallet, debitWallet, withTransaction } from "../services/walletService.js";
import { httpError } from "../utils/httpError.js";
import { getAdminWithdrawal, listAdminWithdrawals, transitionWithdrawal } from "../services/withdrawalService.js";

export async function credit(req, res, next) {
  try {
    const { userId, currency, amount, description } = req.body;
    const result = await withTransaction(async session => {
      const out = await creditWallet({ userId, currency, amount, type: "ADMIN_CREDIT", source: "ADMIN", description, session });
      await AuditLog.create([{
        actorId: req.user._id, targetUserId: userId, action: "WALLET_CREDIT",
        targetType: "Wallet", referenceId: out.ledger.transactionId,
        metadata: { currency, amount }, ip: req.ip
      }], { session });
      return out;
    });
    res.status(201).json({ success: true, wallet: result.wallet, transaction: result.ledger });
  } catch (e) { next(e); }
}

export async function debit(req, res, next) {
  try {
    const { userId, currency, amount, description } = req.body;
    const result = await withTransaction(async session => {
      const out = await debitWallet({ userId, currency, amount, type: "ADMIN_DEBIT", source: "ADMIN", description, session });
      await AuditLog.create([{
        actorId: req.user._id, targetUserId: userId, action: "WALLET_DEBIT",
        targetType: "Wallet", referenceId: out.ledger.transactionId,
        metadata: { currency, amount }, ip: req.ip
      }], { session });
      return out;
    });
    res.status(201).json({ success: true, wallet: result.wallet, transaction: result.ledger });
  } catch (e) { next(e); }
}

export async function process(req, res, next) {
  try {
    const withdrawal = await transitionWithdrawal({
      actorId: req.user._id, withdrawalId: req.params.id,
      nextStatus: "PROCESSING", note: req.body.note, ip: req.ip
    });
    res.json({ success: true, withdrawal });
  } catch (e) { next(e); }
}

export async function approve(req, res, next) {
  try {
    const withdrawal = await transitionWithdrawal({
      actorId: req.user._id, withdrawalId: req.params.id,
      nextStatus: "APPROVED", note: req.body.note, ip: req.ip
    });
    res.json({ success: true, withdrawal });
  } catch (e) { next(e); }
}

export async function reject(req, res, next) {
  try {
    const withdrawal = await transitionWithdrawal({
      actorId: req.user._id, withdrawalId: req.params.id,
      nextStatus: "REJECTED", reason: req.body.reason || "Rejected by administrator.",
      note: req.body.note, ip: req.ip
    });
    res.json({ success: true, withdrawal });
  } catch (e) { next(e); }
}

export async function withdrawals(req, res, next) {
  try {
    res.json({ success: true, ...(await listAdminWithdrawals({
      status: req.query.status, page: req.query.page, limit: req.query.limit
    })) });
  } catch (e) { next(e); }
}

export async function withdrawalDetail(req, res, next) {
  try {
    const item = await getAdminWithdrawal(req.params.id);
    res.json({ success: true, withdrawal: item });
  } catch (e) { next(e); }
}

export async function adminStats(_req, res, next) {
  try {
    const [users, wallets, pendingWithdrawals] = await Promise.all([
      User.countDocuments(), Wallet.countDocuments(), Withdrawal.countDocuments({ status: "PENDING" })
    ]);
    res.json({ success: true, stats: { users, wallets, pendingWithdrawals } });
  } catch (e) { next(e); }
}



export async function updatePayoutOption(req, res, next) {
  try {
    const fields = ["name", "payoutValue", "requiredAmount", "active"];
    const changes = Object.fromEntries(fields.filter(field => Object.hasOwn(req.body, field)).map(field => [field, req.body[field]]));
    const option = await withTransaction(async session => {
      const updated = await PayoutOption.findOneAndUpdate(
        { methodId: req.params.methodId }, { $set: changes },
        { new: true, runValidators: true, session }
      );
      if (!updated) throw httpError("Payout option not found.", 404);
      await AuditLog.create([{
        actorId: req.user._id, action: "PAYOUT_CONFIGURATION_CHANGED",
        targetType: "PayoutOption", referenceId: updated.methodId,
        metadata: { changedFields: Object.keys(changes), changes }, ip: req.ip
      }], { session });
      return updated;
    });
    res.json({ success: true, option });
  } catch (e) { next(e); }
}


