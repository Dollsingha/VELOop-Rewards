import User from "../models/User.js";
import Wallet from "../models/Wallet.js";
import WalletTransaction from "../models/WalletTransaction.js";
import Withdrawal from "../models/Withdrawal.js";
import PayoutOption from "../models/PayoutOption.js";
import AuditLog from "../models/AuditLog.js";
import UserStreak from "../models/UserStreak.js";
import DailyCheckIn from "../models/DailyCheckIn.js";

// Production disables automatic index creation. Ensure required indexes before
// accepting wallet traffic. createIndexes is additive: no indexes/data are dropped.
// Conflicting existing data fails startup for explicit investigation.
export async function ensureWalletIndexes() {
  await Promise.all([User, Wallet, WalletTransaction, Withdrawal, PayoutOption, AuditLog, UserStreak, DailyCheckIn]
    .map(model => model.createIndexes()));
}
