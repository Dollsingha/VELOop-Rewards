import "dotenv/config";
import assert from "node:assert/strict";
import { after, before, beforeEach, test } from "node:test";
import bcrypt from "bcryptjs";
import mongoose from "mongoose";
import { once } from "node:events";
import crypto from "node:crypto";

// Safe local-only default: integration tests always use a database explicitly
// named for tests and never fall back to the development MONGO_URI.
const testUri = process.env.MONGO_TEST_URI || "mongodb://127.0.0.1:27017/veloop_wallet_test?replicaSet=rs0";
process.env.NODE_ENV = "test";
process.env.JWT_SECRET ||= "local-integration-tests-only-secret-not-for-production";
process.env.GOOGLE_CLIENT_ID ||= "qa-test-client-id.apps.googleusercontent.com";
process.env.PAYOUT_DETAILS_ENCRYPTION_KEY ||= '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';
const integrationTest = test;
let models;
let server;
let baseUrl;
let auth;
let ids;

before(async () => {
  const databaseName = decodeURIComponent(new URL(testUri).pathname.slice(1));
  if (!/(^|[-_])test($|[-_])/i.test(databaseName)) {
    throw new Error("MONGO_TEST_URI must use a separate database whose name contains 'test'.");
  }
  process.env.MONGO_URI = testUri;
  const [{ default: app }, db, userModel, walletModel, payoutModel, transactionModel, withdrawalModel, auditModel, streakConfigModel, userStreakModel, checkInModel, jwt, razorpayPayoutModel] = await Promise.all([
    import("../src/app.js"),
    import("../src/config/db.js"),
    import("../src/models/User.js"),
    import("../src/models/Wallet.js"),
    import("../src/models/PayoutOption.js"),
    import("../src/models/WalletTransaction.js"),
    import("../src/models/Withdrawal.js"),
    import("../src/models/AuditLog.js"),
    import("../src/models/StreakConfig.js"),
    import("../src/models/UserStreak.js"),
    import("../src/models/DailyCheckIn.js"),
    import("../src/utils/jwt.js"),
    import("../src/models/RazorpayTestPayout.js")
  ]);
  await db.connectDB();
  models = [userModel.default, walletModel.default, payoutModel.default, transactionModel.default, withdrawalModel.default, auditModel.default, streakConfigModel.default, userStreakModel.default, checkInModel.default, razorpayPayoutModel.default];
  auth = { signToken: jwt.signToken };
  server = app.listen(0, "127.0.0.1");
  await once(server, "listening");
  baseUrl = `http://127.0.0.1:${server.address().port}/api`;
});

after(async () => {
  if (server) await new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
  if (mongoose.connection.readyState) await mongoose.disconnect();
});

beforeEach(async () => {
  const [User, Wallet, PayoutOption, WalletTransaction, Withdrawal, AuditLog, StreakConfig] = models;
  await Promise.all(models.map(model => model.deleteMany({})));
  const password = await bcrypt.hash("TestPassword123", 4);
  const [admin, user, other] = await User.create([
    { name: "Test Admin", email: "admin@test.local", password, role: "ADMIN" },
    { name: "Test User", email: "user@test.local", password, role: "USER" },
    { name: "Other User", email: "other@test.local", password, role: "USER" }
  ]);
  await Wallet.create([
    { userId: user._id, ves: 10000, sves: 0, gems: 0, tokens: 0, spins: 0 },
    { userId: other._id, ves: 2000, sves: 0, gems: 0, tokens: 0, spins: 0 }
  ]);
  const requiredDetails = [{ key: "upiId", label: "UPI ID", inputType: "text", required: true }];
  await PayoutOption.insertMany([
    { methodId: "upi_10", method: "upi", name: "UPI", type: "BANK_LIKE", currency: "VES", payoutValue: 10, requiredAmount: 2400, requiredDetails, active: true },
    { methodId: "upi_50", method: "upi", name: "UPI", type: "BANK_LIKE", currency: "VES", payoutValue: 50, requiredAmount: 10000, requiredDetails, active: true },
    { methodId: "upi_8000", method: "upi", name: "UPI", type: "BANK_LIKE", currency: "VES", payoutValue: 40, requiredAmount: 8000, requiredDetails, active: true }
  ]);
  await StreakConfig.create({ _id: "default", active: true, timeZone: "Asia/Kolkata", milestoneDays: 10, milestoneRewardVES: 1000 });
  ids = { admin: admin._id, user: user._id, other: other._id };
  ids.adminToken = auth.signToken(admin);
  ids.userToken = auth.signToken(user);
  ids.otherToken = auth.signToken(other);
  ids.User = User;
  ids.Wallet = Wallet;
  ids.WalletTransaction = WalletTransaction;
  ids.Withdrawal = Withdrawal;
  ids.AuditLog = AuditLog;
  ids.UserStreak = models[7];
  ids.DailyCheckIn = models[8];
  ids.RazorpayTestPayout = models[9];
});

async function api(path, { token = ids.userToken, method = "GET", body, headers = {} } = {}) {
  const response = await fetch(`${baseUrl}${path}`, {
    method,
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(body ? { "Content-Type": "application/json" } : {}),
      ...headers
    },
    ...(body ? { body: JSON.stringify(body) } : {})
  });
  return { status: response.status, data: await response.json() };
}

async function setVES(userId, amount) {
  await ids.Wallet.updateOne({ userId }, { $set: { ves: amount } });
}

integrationTest("Google auth endpoint rejects an invalid credential without creating a user", async () => {
  const usersBefore = await ids.User.countDocuments();
  const response = await api("/auth/google", {
    token: null, method: "POST", body: { credential: "not-a-google-id-token" }
  });
  assert.equal(response.status, 401);
  assert.match(response.data.message, /Google sign-in could not be verified/);
  assert.equal(await ids.User.countDocuments(), usersBefore);
});

integrationTest("registration creates the user and wallet atomically", async () => {
  const response = await api("/auth/register", {
    token: null, method: "POST",
    body: { name: "New Member", email: "new.member@example.test", password: "LongEnough123" }
  });
  assert.equal(response.status, 201);
  assert.ok(response.data.token);
  const wallet = await ids.Wallet.findOne({ userId: response.data.user.id });
  assert.ok(wallet);
  assert.equal(wallet.ves, 0);
});

integrationTest("route validators reject invalid payout methods, pagination, and short passwords", async () => {
  const method = await api("/payout/options/unknown");
  assert.equal(method.status, 400);

  const pagination = await api("/wallet/transactions?page=not-a-number");
  assert.equal(pagination.status, 400);

  const registration = await api("/auth/register", {
    token: null, method: "POST",
    body: { name: "New Member", email: "short.password@example.test", password: "short" }
  });
  assert.equal(registration.status, 400);
  assert.equal(await ids.User.exists({ email: "short.password@example.test" }), null);
});

integrationTest("normal admin credit updates balance and creates a matching ledger row", async () => {
  await setVES(ids.user, 1000);
  const response = await api("/admin/wallet/credit", {
    token: ids.adminToken, method: "POST",
    body: { userId: String(ids.user), currency: "VES", amount: 500, description: "Test reward" }
  });
  assert.equal(response.status, 201);
  assert.equal(response.data.wallet.ves, 1500);
  assert.equal(response.data.transaction.balanceBefore, 1000);
  assert.equal(response.data.transaction.balanceAfter, 1500);
});

integrationTest("all five wallet currencies support protected audited credits and debits", async () => {
  const fields = { VES: "ves", SVES: "sves", GEMS: "gems", TOKENS: "tokens", SPINS: "spins" };
  for (const [currency, field] of Object.entries(fields)) {
    const before = (await ids.Wallet.findOne({ userId: ids.user }))[field];
    const body = { userId: String(ids.user), currency, amount: 10, description: "Currency operation verification" };
    const denied = await api("/admin/wallet/credit", { method: "POST", body });
    assert.equal(denied.status, 403);
    const credited = await api("/admin/wallet/credit", { token: ids.adminToken, method: "POST", body });
    assert.equal(credited.status, 201);
    assert.equal(credited.data.wallet[field], before + 10);
    assert.equal(credited.data.transaction.balanceBefore, before);
    assert.equal(credited.data.transaction.balanceAfter, before + 10);
    const debited = await api("/admin/wallet/debit", { token: ids.adminToken, method: "POST", body: { ...body, amount: 3 } });
    assert.equal(debited.status, 201);
    assert.equal(debited.data.wallet[field], before + 7);
    assert.equal(debited.data.transaction.balanceBefore, before + 10);
    assert.equal(debited.data.transaction.balanceAfter, before + 7);
  }
  assert.equal(await ids.AuditLog.countDocuments({ action: "WALLET_CREDIT" }), 5);
  assert.equal(await ids.AuditLog.countDocuments({ action: "WALLET_DEBIT" }), 5);
});

integrationTest("failure while creating withdrawal rolls back its debit and ledger", async t => {
  t.mock.method(ids.Withdrawal, "create", async () => { throw new Error("Injected persistence failure"); });
  const result = await api("/withdrawals", {
    method: "POST", headers: { "Idempotency-Key": "rollback-verification-0001" },
    body: { method: "upi", optionId: "upi_10", payoutDetails: { upiId: "qa@bank" } }
  });
  assert.equal(result.status, 500);
  assert.equal(result.data.message, "Internal server error.");
  assert.equal((await ids.Wallet.findOne({ userId: ids.user })).ves, 10000);
  assert.equal(await ids.WalletTransaction.countDocuments({ userId: ids.user }), 0);
  assert.equal(await ids.Withdrawal.countDocuments({ userId: ids.user }), 0);
});

integrationTest("normal withdrawal uses configured VEs and writes a debit ledger row", async () => {
  await setVES(ids.user, 5000);
  const response = await api("/withdrawals", {
    method: "POST", headers: { "Idempotency-Key": "normal-withdrawal-0001" },
    body: { method: "upi", optionId: "upi_10", payoutDetails: { upiId: "demo@bank" } }
  });
  assert.equal(response.status, 201);
  assert.equal(response.data.withdrawal.currencyAmount, 2400);
  const wallet = await ids.Wallet.findOne({ userId: ids.user });
  const ledger = await ids.WalletTransaction.findOne({ referenceId: response.data.withdrawal.withdrawalId });
  assert.equal(wallet.ves, 2600);
  assert.equal(ledger.direction, "DEBIT");
  assert.equal(ledger.balanceBefore, 5000);
  assert.equal(ledger.balanceAfter, 2600);
});

integrationTest("insufficient balance rejects withdrawal without changing wallet", async () => {
  await setVES(ids.user, 500);
  const response = await api("/withdrawals", {
    method: "POST", headers: { "Idempotency-Key": "insufficient-balance-01" },
    body: { method: "upi", optionId: "upi_10", payoutDetails: { upiId: "demo@bank" } }
  });
  assert.equal(response.status, 400);
  assert.match(response.data.message, /Insufficient VES balance/);
  assert.equal((await ids.Wallet.findOne({ userId: ids.user })).ves, 500);
  assert.equal(await ids.Withdrawal.countDocuments({ userId: ids.user }), 0);
});

integrationTest("repeated withdrawal with the same key creates one debit and one request", async () => {
  const body = { method: "upi", optionId: "upi_10", payoutDetails: { upiId: "demo@bank" } };
  const headers = { "Idempotency-Key": "duplicate-withdrawal-0001" };
  const first = await api("/withdrawals", { method: "POST", body, headers });
  const second = await api("/withdrawals", { method: "POST", body, headers });
  assert.equal(first.status, 201);
  assert.equal(second.status, 200);
  assert.equal(second.data.duplicate, true);
  assert.equal(await ids.Withdrawal.countDocuments({ userId: ids.user }), 1);
  assert.equal((await ids.Wallet.findOne({ userId: ids.user })).ves, 7600);
  assert.equal(await ids.WalletTransaction.countDocuments({ userId: ids.user, direction: "DEBIT" }), 1);
});

integrationTest("concurrent withdrawals cannot spend the same VEs twice", async () => {
  await setVES(ids.user, 10000);
  const makeRequest = key => api("/withdrawals", {
    method: "POST", headers: { "Idempotency-Key": key },
    body: { method: "upi", optionId: "upi_8000", payoutDetails: { upiId: "demo@bank" } }
  });
  const responses = await Promise.all([makeRequest("concurrent-withdrawal-A"), makeRequest("concurrent-withdrawal-B")]);
  assert.equal(responses.filter(response => response.status === 201).length, 1);
  assert.equal(responses.filter(response => response.status === 400).length, 1);
  assert.equal((await ids.Wallet.findOne({ userId: ids.user })).ves, 2000);
  assert.equal(await ids.Withdrawal.countDocuments({ userId: ids.user }), 1);
});

integrationTest("simultaneous identical requests return one withdrawal even when the first spends all VEs", async () => {
  await setVES(ids.user, 2400);
  const request = { method: "POST", headers: { "Idempotency-Key": "same-key-concurrent-0001" },
    body: { method: "upi", optionId: "upi_10", payoutDetails: { upiId: "qa@bank" } } };
  const results = await Promise.all([api("/withdrawals", request), api("/withdrawals", request)]);
  assert.ok(results.every(result => [200, 201].includes(result.status)), JSON.stringify(results));
  assert.equal(new Set(results.map(result => result.data.withdrawal.withdrawalId)).size, 1);
  assert.equal((await ids.Wallet.findOne({ userId: ids.user })).ves, 0);
  assert.equal(await ids.Withdrawal.countDocuments({ userId: ids.user }), 1);
  assert.equal(await ids.WalletTransaction.countDocuments({ userId: ids.user, direction: "DEBIT" }), 1);
});

integrationTest("reusing a withdrawal key with changed details cannot cause another debit", async () => {
  const headers = { "Idempotency-Key": "changed-details-key-0001" };
  const body = { method: "upi", optionId: "upi_10", payoutDetails: { upiId: "qa@bank" } };
  assert.equal((await api("/withdrawals", { method: "POST", headers, body })).status, 201);
  const changed = await api("/withdrawals", { method: "POST", headers,
    body: { ...body, payoutDetails: { upiId: "another@bank" } } });
  assert.equal(changed.status, 409);
  assert.equal((await ids.Wallet.findOne({ userId: ids.user })).ves, 7600);
  assert.equal(await ids.Withdrawal.countDocuments({ userId: ids.user }), 1);
});

integrationTest("manual approval requires processing and terminal states cannot refund or debit again", async () => {
  const created = await api("/withdrawals", { method: "POST",
    headers: { "Idempotency-Key": "manual-state-review-0001" },
    body: { method: "upi", optionId: "upi_10", payoutDetails: { upiId: "qa@bank" } } });
  const id = created.data.withdrawal.withdrawalId;
  const review = action => api(`/admin/withdrawals/${id}/${action}`, { token: ids.adminToken, method: "POST", body: {} });
  assert.equal((await review("approve")).status, 409);
  assert.equal((await review("process")).data.withdrawal.status, "PROCESSING");
  assert.equal((await review("approve")).data.withdrawal.status, "APPROVED");
  assert.equal((await review("approve")).status, 409);
  assert.equal((await review("reject")).status, 409);
  assert.equal((await api(`/withdrawals/${id}/cancel`, { method: "POST" })).status, 409);
  assert.equal((await ids.Wallet.findOne({ userId: ids.user })).ves, 7600);
  assert.equal(await ids.WalletTransaction.countDocuments({ userId: ids.user, type: "WITHDRAWAL_REVERSAL" }), 0);
  assert.equal(await ids.AuditLog.countDocuments({ referenceId: id, action: "WITHDRAWAL_APPROVED" }), 1);
});

integrationTest("protected APIs reject missing, invalid and expired JWTs", async () => {
  const { default: jwt } = await import("jsonwebtoken");
  const expired = jwt.sign({ userId: String(ids.user) }, process.env.JWT_SECRET, { algorithm: "HS256", expiresIn: -1 });
  for (const token of [null, "invalid-token", expired]) {
    assert.equal((await api("/wallet", { token })).status, 401);
    assert.equal((await api("/payout/methods", { token })).status, 401);
    assert.equal((await api("/withdrawals", { token })).status, 401);
  }
});

integrationTest("password login works and registration cannot grant an admin role", async () => {
  const login = await api("/auth/login", { token: null, method: "POST",
    body: { email: "user@test.local", password: "TestPassword123" } });
  assert.equal(login.status, 200);
  assert.equal((await api("/wallet", { token: login.data.token })).status, 200);
  assert.equal((await api("/auth/login", { token: null, method: "POST",
    body: { email: "user@test.local", password: "incorrect" } })).status, 401);
  const registered = await api("/auth/register", { token: null, method: "POST",
    body: { name: "QA role check", email: "role.check@example.test", password: "StrongEnough123", role: "ADMIN", ves: 999999 } });
  assert.equal(registered.status, 201);
  assert.equal(registered.data.user.role, "USER");
  const wallet = await api("/wallet", { token: registered.data.token });
  assert.equal(wallet.data.wallet.ves, 0);
  assert.equal((await api("/admin/stats", { token: registered.data.token })).status, 403);
});

integrationTest("invalid payout option is rejected", async () => {
  const response = await api("/withdrawals", {
    method: "POST", headers: { "Idempotency-Key": "invalid-option-request-01" },
    body: { method: "upi", optionId: "upi_999999", payoutDetails: { upiId: "demo@bank" } }
  });
  assert.equal(response.status, 400);
  assert.match(response.data.message, /Selected payout option is unavailable/);
});

integrationTest("malformed UPI ID is rejected without debiting the wallet", async () => {
  const response = await api("/withdrawals", {
    method: "POST", headers: { "Idempotency-Key": "invalid-upi-request-01" },
    body: { method: "upi", optionId: "upi_10", payoutDetails: { upiId: "not-a-upi-id" } }
  });
  assert.equal(response.status, 400);
  assert.match(response.data.message, /Invalid UPI ID/);
  assert.equal((await ids.Wallet.findOne({ userId: ids.user })).ves, 10000);
  assert.equal(await ids.Withdrawal.countDocuments({ userId: ids.user }), 0);
});

integrationTest("payout APIs return database-configured form requirements and currency", async () => {
  const methods = await api("/payout/methods");
  assert.equal(methods.status, 200);
  assert.deepEqual(methods.data.methods[0].requiredDetails, [
    { key: "upiId", label: "UPI ID", inputType: "text", required: true }
  ]);

  const options = await api("/payout/options/upi");
  assert.equal(options.status, 200);
  assert.equal(options.data.options[0].payoutCurrency, "INR");
  assert.deepEqual(options.data.options[0].requiredDetails, [
    { key: "upiId", label: "UPI ID", inputType: "text", required: true }
  ]);
});

integrationTest("query manipulation cannot read another user's wallet", async () => {
  const response = await api(`/wallet?userId=${ids.other}`);
  assert.equal(response.status, 200);
  assert.equal(String(response.data.wallet.userId), String(ids.user));
  assert.notEqual(String(response.data.wallet.userId), String(ids.other));
});

integrationTest("rejected withdrawal is reversed once and remains in history", async () => {
  const created = await api("/withdrawals", {
    method: "POST", headers: { "Idempotency-Key": "rejection-reversal-0001" },
    body: { method: "upi", optionId: "upi_10", payoutDetails: { upiId: "demo@bank" } }
  });
  const id = created.data.withdrawal.withdrawalId;
  const processing = await api(`/admin/withdrawals/${id}/process`, { token: ids.adminToken, method: "POST", body: {} });
  assert.equal(processing.status, 200);
  const rejected = await api(`/admin/withdrawals/${id}/reject`, {
    token: ids.adminToken, method: "POST", body: { reason: "Test rejection" }
  });
  assert.equal(rejected.status, 200);
  assert.equal(rejected.data.withdrawal.status, "REJECTED");
  assert.equal((await ids.Wallet.findOne({ userId: ids.user })).ves, 10000);
  assert.equal(await ids.WalletTransaction.countDocuments({ userId: ids.user, type: "WITHDRAWAL_REVERSAL" }), 1);
});

integrationTest("user can cancel only a pending withdrawal and receives one reversal", async () => {
  const created = await api("/withdrawals", {
    method: "POST", headers: { "Idempotency-Key": "user-cancellation-0001" },
    body: { method: "upi", optionId: "upi_10", payoutDetails: { upiId: "demo@bank" } }
  });
  const id = created.data.withdrawal.withdrawalId;
  const cancelled = await api(`/withdrawals/${id}/cancel`, { method: "POST" });
  assert.equal(cancelled.status, 200);
  assert.equal(cancelled.data.withdrawal.status, "CANCELLED");
  assert.equal((await ids.Wallet.findOne({ userId: ids.user })).ves, 10000);
  assert.equal(await ids.WalletTransaction.countDocuments({ userId: ids.user, type: "WITHDRAWAL_REVERSAL" }), 1);

  const repeated = await api(`/withdrawals/${id}/cancel`, { method: "POST" });
  assert.equal(repeated.status, 409);
  assert.equal((await ids.Wallet.findOne({ userId: ids.user })).ves, 10000);
  assert.equal(await ids.WalletTransaction.countDocuments({ userId: ids.user, type: "WITHDRAWAL_REVERSAL" }), 1);
});

integrationTest("frontend-supplied payout amounts and currencies are ignored", async () => {
  await setVES(ids.user, 5000);
  const response = await api("/withdrawals", {
    method: "POST", headers: { "Idempotency-Key": "api-manipulation-000001" },
    body: {
      method: "upi", optionId: "upi_10", amount: 1, currency: "GEMS",
      payoutValue: 999999, requiredAmount: 1,
      payoutDetails: { upiId: "demo@bank" }
    }
  });
  assert.equal(response.status, 201);
  assert.equal(response.data.withdrawal.currencyAmount, 2400);
  assert.equal(response.data.withdrawal.payoutAmount, 10);
  assert.equal((await ids.Wallet.findOne({ userId: ids.user })).ves, 2600);
});

integrationTest("a different user cannot read another user's withdrawal", async () => {
  const created = await api("/withdrawals", {
    method: "POST", headers: { "Idempotency-Key": "cross-user-withdrawal-01" },
    body: { method: "upi", optionId: "upi_10", payoutDetails: { upiId: "demo@bank" } }
  });
  const response = await api(`/withdrawals/${created.data.withdrawal.withdrawalId}`, { token: ids.otherToken });
  assert.equal(response.status, 404);
});

integrationTest("daily streak is user-scoped, server dated, and repeat check-in is idempotent", async () => {
  const initial = await api(`/wallet/streak?userId=${ids.other}`);
  assert.equal(initial.status, 200);
  assert.equal(initial.data.streak.currentStreak, 0);
  assert.equal(initial.data.streak.week.length, 7);
  assert.equal(initial.data.streak.milestone.days, 10);

  const first = await api("/wallet/streak/check-in", {
    method: "POST", body: { dayKey: "2099-01-01", streakDay: 999, rewardVES: 999999 }
  });
  assert.equal(first.status, 201);
  assert.equal(first.data.streak.currentStreak, 1);
  assert.equal(first.data.rewardGrantedVES, 0);
  const repeat = await api("/wallet/streak/check-in", { method: "POST", body: { rewardVES: 999999 } });
  assert.equal(repeat.status, 200);
  assert.equal(repeat.data.alreadyCheckedIn, true);
  assert.equal((await ids.DailyCheckIn.countDocuments({ userId: ids.user })), 1);
  assert.equal((await ids.Wallet.findOne({ userId: ids.user })).ves, 10000);
  assert.equal(await ids.DailyCheckIn.countDocuments({ userId: ids.other }), 0);
});

integrationTest("10-day streak milestone credits once with a balanced wallet ledger", async () => {
  const { streakDayKey } = await import("../src/services/streakService.js");
  const today = streakDayKey(new Date(), "Asia/Kolkata");
  const [year, month, day] = today.split("-").map(Number);
  const yesterdayDate = new Date(Date.UTC(year, month - 1, day - 1));
  const yesterday = `${yesterdayDate.getUTCFullYear()}-${String(yesterdayDate.getUTCMonth() + 1).padStart(2, "0")}-${String(yesterdayDate.getUTCDate()).padStart(2, "0")}`;
  await ids.UserStreak.create({ userId: ids.user, currentStreak: 9, longestStreak: 9, lastCheckInDay: yesterday });
  const response = await api("/wallet/streak/check-in", { method: "POST", body: {} });
  assert.equal(response.status, 201);
  assert.equal(response.data.rewardGrantedVES, 1000);
  assert.equal(response.data.streak.currentStreak, 10);
  const wallet = await ids.Wallet.findOne({ userId: ids.user });
  const ledger = await ids.WalletTransaction.findOne({ userId: ids.user, source: "STREAK_MILESTONE" });
  assert.equal(wallet.ves, 11000);
  assert.equal(ledger.type, "DAILY_REWARD");
  assert.equal(ledger.balanceBefore, 10000);
  assert.equal(ledger.balanceAfter, 11000);
  assert.equal(await ids.WalletTransaction.countDocuments({ userId: ids.user, source: "STREAK_MILESTONE" }), 1);
});

integrationTest("concurrent same-day streak check-ins cannot double award a milestone", async () => {
  const { streakDayKey } = await import("../src/services/streakService.js");
  const today = streakDayKey(new Date(), "Asia/Kolkata");
  const [year, month, day] = today.split("-").map(Number);
  const yesterdayDate = new Date(Date.UTC(year, month - 1, day - 1));
  const yesterday = `${yesterdayDate.getUTCFullYear()}-${String(yesterdayDate.getUTCMonth() + 1).padStart(2, "0")}-${String(yesterdayDate.getUTCDate()).padStart(2, "0")}`;
  await ids.UserStreak.create({ userId: ids.user, currentStreak: 9, longestStreak: 9, lastCheckInDay: yesterday });
  const responses = await Promise.all([
    api("/wallet/streak/check-in", { method: "POST", body: {} }),
    api("/wallet/streak/check-in", { method: "POST", body: {} })
  ]);
  assert.ok(responses.every(response => response.status === 200 || response.status === 201));
  assert.equal((await ids.Wallet.findOne({ userId: ids.user })).ves, 11000);
  assert.equal(await ids.DailyCheckIn.countDocuments({ userId: ids.user }), 1);
  assert.equal(await ids.WalletTransaction.countDocuments({ userId: ids.user, source: "STREAK_MILESTONE" }), 1);
});


test("payout details are authenticated encrypted at rest", async () => {
  const { encryptPayoutDetails, decryptPayoutDetails } = await import("../src/utils/encryption.js");
  const original = { upiId: "demo@bank" };
  const encrypted = encryptPayoutDetails(original);
  assert.notEqual(encrypted, JSON.stringify(original));
  assert.deepEqual(decryptPayoutDetails(encrypted), original);
});

function assessmentEnvironment(t, email) {
  const values = { ASSESSMENT_REVIEW_ENABLED: "true", ASSESSMENT_DB_NAME: mongoose.connection.name,
    ASSESSMENT_REVIEW_EMAIL: email, ASSESSMENT_REVIEW_PASSWORD: "assessment-test-password-only-12345" };
  const previous = Object.fromEntries(Object.keys(values).map(key => [key, process.env[key]]));
  Object.assign(process.env, values);
  t.after(() => Object.entries(previous).forEach(([key,value]) => value === undefined ? delete process.env[key] : process.env[key] = value));
}

integrationTest("assessment fixture creates all five balances with complete auditable ledgers once", async t => {
  assessmentEnvironment(t, "assessment.review@example.test");
  const { ensureAssessmentAccount } = await import("../src/services/assessmentSeedService.js");
  assert.equal((await ensureAssessmentAccount()).created, true);
  const user = await ids.User.findOne({ email: process.env.ASSESSMENT_REVIEW_EMAIL });
  assert.equal(user.role, "USER");
  const wallet = await ids.Wallet.findOne({ userId: user._id }).lean();
  assert.deepEqual(Object.fromEntries(["ves","sves","gems","tokens","spins"].map(key => [key,wallet[key]])),
    { ves: 25000, sves: 5000, gems: 100, tokens: 500, spins: 3 });
  assert.equal(await ids.WalletTransaction.countDocuments({ userId: user._id }), 8);
  assert.equal((await ensureAssessmentAccount()).created, false);
  assert.equal(await ids.WalletTransaction.countDocuments({ userId: user._id }), 8);
  assert.equal(await ids.AuditLog.countDocuments({ targetUserId: user._id, action: "ASSESSMENT_ACCOUNT_SEEDED" }), 1);
});

integrationTest("assessment fixture never overwrites an existing user account", async t => {
  assessmentEnvironment(t, "user@test.local");
  const { ensureAssessmentAccount } = await import("../src/services/assessmentSeedService.js");
  await assert.rejects(ensureAssessmentAccount(), /already in use/);
  assert.equal((await ids.Wallet.findOne({ userId: ids.user })).ves, 10000);
  assert.equal(await ids.WalletTransaction.countDocuments({ userId: ids.user }), 0);
});

integrationTest("assessment fixture is disabled by default and rejects the wrong database", async t => {
  assessmentEnvironment(t, "assessment.review@example.test");
  const { ensureAssessmentAccount } = await import("../src/services/assessmentSeedService.js");
  process.env.ASSESSMENT_REVIEW_ENABLED = "false";
  assert.equal(await ensureAssessmentAccount(), null);
  process.env.ASSESSMENT_REVIEW_ENABLED = "true";
  process.env.ASSESSMENT_DB_NAME = "not-the-connected-database";
  await assert.rejects(ensureAssessmentAccount(), /matching development database/);
  assert.equal(await ids.User.countDocuments(), 3);
});

function configureTestProvider(t) {
  const values = {
    RAZORPAYX_TEST_ENABLED: "true", RAZORPAYX_TEST_KEY_ID: "rzp_test_fixture123",
    RAZORPAYX_TEST_KEY_SECRET: "test-secret-only", RAZORPAYX_TEST_ACCOUNT_NUMBER: "test-account-only",
    RAZORPAYX_TEST_WEBHOOK_SECRET: "test-webhook-secret-only"
  };
  const previous = Object.fromEntries(Object.keys(values).map(key => [key, process.env[key]]));
  Object.assign(process.env, values);
  t.after(() => Object.entries(previous).forEach(([key, value]) => value === undefined ? delete process.env[key] : process.env[key] = value));
}

function mockProvider(t, handler) {
  const originalFetch = globalThis.fetch;
  t.mock.method(globalThis, "fetch", async (url, options) => {
    if (!String(url).startsWith("https://api.razorpay.com/v1/")) return originalFetch(url, options);
    const result = await handler(String(url), options);
    return new Response(JSON.stringify(result), { status: 200, headers: { "Content-Type": "application/json" } });
  });
}

async function requestTestWithdrawal() {
  const response = await api("/withdrawals", {
    method: "POST", headers: { "Idempotency-Key": "razorpay-test-withdrawal" },
    body: { method: "upi", optionId: "upi_10", payoutDetails: { upiId: "demo@bank" } }
  });
  assert.equal(response.status, 201);
  return response.data.withdrawal.withdrawalId;
}

integrationTest("Razorpay test payout is admin-only and rejects missing configuration or live keys", async t => {
  configureTestProvider(t);
  const withdrawalId = await requestTestWithdrawal();
  const path = `/admin/withdrawals/${withdrawalId}/razorpay-test`;
  assert.equal((await api(path, { method: "POST", body: {} })).status, 403);
  process.env.RAZORPAYX_TEST_ENABLED = "false";
  assert.equal((await api(path, { token: ids.adminToken, method: "POST", body: {} })).status, 503);
  process.env.RAZORPAYX_TEST_ENABLED = "true";
  process.env.RAZORPAYX_TEST_KEY_ID = "rzp_live_forbidden";
  assert.equal((await api(path, { token: ids.adminToken, method: "POST", body: {} })).status, 503);
  assert.equal((await ids.Withdrawal.findOne({ withdrawalId })).status, "PENDING");
  assert.equal(await ids.RazorpayTestPayout.countDocuments(), 0);
});

integrationTest("Razorpay test payout uses server amount, submits once, and confirms provider success", async t => {
  configureTestProvider(t);
  const withdrawalId = await requestTestWithdrawal();
  let submissions = 0;
  const entity = { id: "pout_Test123", entity: "payout", reference_id: withdrawalId, amount: 1000, currency: "INR", mode: "UPI", status: "processing" };
  mockProvider(t, async (_url, options) => {
    if (options.method === "POST") {
      submissions++;
      const body = JSON.parse(options.body);
      assert.equal(body.amount, 1000);
      assert.equal(body.currency, "INR");
      assert.equal(body.reference_id, withdrawalId);
      assert.match(options.headers["X-Payout-Idempotency"], /^[0-9a-f-]{36}$/);
      assert.equal(body.fund_account.vpa.address, "demo@bank");
    }
    return entity;
  });
  const path = `/admin/withdrawals/${withdrawalId}/razorpay-test`;
  const submitted = await api(path, { token: ids.adminToken, method: "POST", body: { amount: 999999, currency: "USD" } });
  assert.equal(submitted.status, 200);
  assert.equal(submitted.data.withdrawal.status, "PROCESSING");
  assert.equal((await api(path, { token: ids.adminToken, method: "POST", body: {} })).data.duplicate, true);
  assert.equal(submissions, 1);
  entity.status = "processed";
  const confirmed = await api(`${path}/reconcile`, { token: ids.adminToken, method: "POST", body: {} });
  assert.equal(confirmed.data.withdrawal.status, "APPROVED");
  assert.equal((await ids.Wallet.findOne({ userId: ids.user })).ves, 7600);
});

integrationTest("uncertain provider response holds the debit and requires reconciliation", async t => {
  configureTestProvider(t);
  const withdrawalId = await requestTestWithdrawal();
  let submissions = 0;
  mockProvider(t, async (_url, options) => {
    if (options.method === "POST") { submissions++; throw new Error("Simulated transport timeout"); }
    return { items: [{ id: "pout_TestUnknown", entity: "payout", reference_id: withdrawalId, amount: 1000, currency: "INR", mode: "UPI", status: "failed" }] };
  });
  const path = `/admin/withdrawals/${withdrawalId}/razorpay-test`;
  assert.equal((await api(path, { token: ids.adminToken, method: "POST", body: {} })).status, 502);
  assert.equal((await api(path, { token: ids.adminToken, method: "POST", body: {} })).status, 409);
  assert.equal((await api(`/admin/withdrawals/${withdrawalId}/reject`, { token: ids.adminToken, method: "POST", body: {} })).status, 409);
  assert.equal(submissions, 1);
  assert.equal((await ids.Wallet.findOne({ userId: ids.user })).ves, 7600);
  const reconciled = await api(`${path}/reconcile`, { token: ids.adminToken, method: "POST", body: {} });
  assert.equal(reconciled.data.withdrawal.status, "REJECTED");
  assert.equal((await ids.Wallet.findOne({ userId: ids.user })).ves, 10000);
});

integrationTest("signed provider webhook verifies latest state and reverses only once", async t => {
  configureTestProvider(t);
  const withdrawalId = await requestTestWithdrawal();
  const entity = { id: "pout_TestWebhook", entity: "payout", reference_id: withdrawalId, amount: 1000, currency: "INR", mode: "UPI", status: "processing" };
  mockProvider(t, async () => entity);
  const path = `/admin/withdrawals/${withdrawalId}/razorpay-test`;
  assert.equal((await api(path, { token: ids.adminToken, method: "POST", body: {} })).status, 200);
  const raw = JSON.stringify({ event: "payout.processed", payload: { payout: { entity } } });
  const signature = crypto.createHmac("sha256", process.env.RAZORPAYX_TEST_WEBHOOK_SECRET).update(raw).digest("hex");
  const send = async signatureValue => fetch(`${baseUrl}/webhooks/razorpayx-test`, {
    method: "POST", body: raw, headers: { "Content-Type": "application/json", "x-razorpay-signature": signatureValue }
  });
  assert.equal((await send("0".repeat(64))).status, 401);
  entity.status = "failed"; // The latest provider result wins over the stale event's status.
  assert.equal((await send(signature)).status, 200);
  assert.equal((await send(signature)).status, 200);
  assert.equal((await ids.Wallet.findOne({ userId: ids.user })).ves, 10000);
  assert.equal(await ids.WalletTransaction.countDocuments({ referenceId: withdrawalId, source: "RAZORPAYX_TEST_REVERSAL" }), 1);
});

integrationTest("mismatched provider payout cannot approve or refund a withdrawal", async t => {
  configureTestProvider(t);
  const withdrawalId = await requestTestWithdrawal();
  mockProvider(t, async () => ({ id: "pout_TestMismatch", entity: "payout", reference_id: withdrawalId, amount: 999999, currency: "INR", mode: "UPI", status: "processed" }));
  const response = await api(`/admin/withdrawals/${withdrawalId}/razorpay-test`, { token: ids.adminToken, method: "POST", body: {} });
  assert.equal(response.status, 502);
  assert.equal((await ids.Withdrawal.findOne({ withdrawalId })).status, "PROCESSING");
  assert.equal((await ids.Wallet.findOne({ userId: ids.user })).ves, 7600);
});

integrationTest("transaction pagination returns only the authenticated user's ledger", async () => {
  for (let index = 0; index < 7; index++) {
    assert.equal((await api("/admin/wallet/credit", { token: ids.adminToken, method: "POST",
      body: { userId: String(ids.user), currency: "VES", amount: 1 } })).status, 201);
  }
  assert.equal((await api("/admin/wallet/credit", { token: ids.adminToken, method: "POST",
    body: { userId: String(ids.other), currency: "VES", amount: 1 } })).status, 201);
  const first = await api(`/wallet/transactions?page=1&limit=3&userId=${ids.other}`);
  const second = await api("/wallet/transactions?page=2&limit=3");
  assert.equal(first.data.total, 7);
  assert.equal(first.data.pages, 3);
  assert.equal(first.data.items.length, 3);
  assert.equal(second.data.items.length, 3);
  assert.ok(first.data.items.every(item => String(item.userId) === String(ids.user)));
  assert.equal(new Set([...first.data.items, ...second.data.items].map(item => item.transactionId)).size, 6);
});

integrationTest("wallet rate limiting returns 429 for repeated requests", async () => {
  let response;
  for (let count = 0; count <= 1000; count++) {
    response = await fetch(`${baseUrl}/wallet`);
    if (response.status === 429) break;
    assert.equal(response.status, 401);
  }
  assert.equal(response.status, 429);
  assert.ok(response.headers.get("ratelimit"));
  assert.match(await response.text(), /Too many requests/i);
});
