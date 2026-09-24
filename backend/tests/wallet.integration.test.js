import "dotenv/config";
import assert from "node:assert/strict";
import { after, before, beforeEach, test } from "node:test";
import bcrypt from "bcryptjs";
import mongoose from "mongoose";
import { once } from "node:events";

// Safe local-only default: integration tests always use a database explicitly
// named for tests and never fall back to the development MONGO_URI.
const testUri = process.env.MONGO_TEST_URI || "mongodb://127.0.0.1:27017/veloop_wallet_test?replicaSet=rs0";
process.env.NODE_ENV = "test";
process.env.JWT_SECRET ||= "local-integration-tests-only-secret-not-for-production";
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
  const [{ default: app }, db, userModel, walletModel, payoutModel, transactionModel, withdrawalModel, auditModel, jwt] = await Promise.all([
    import("../src/app.js"),
    import("../src/config/db.js"),
    import("../src/models/User.js"),
    import("../src/models/Wallet.js"),
    import("../src/models/PayoutOption.js"),
    import("../src/models/WalletTransaction.js"),
    import("../src/models/Withdrawal.js"),
    import("../src/models/AuditLog.js"),
    import("../src/utils/jwt.js")
  ]);
  await db.connectDB();
  models = [userModel.default, walletModel.default, payoutModel.default, transactionModel.default, withdrawalModel.default, auditModel.default];
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
  const [User, Wallet, PayoutOption, WalletTransaction, Withdrawal, AuditLog] = models;
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
  ids = { admin: admin._id, user: user._id, other: other._id };
  ids.adminToken = auth.signToken(admin);
  ids.userToken = auth.signToken(user);
  ids.otherToken = auth.signToken(other);
  ids.User = User;
  ids.Wallet = Wallet;
  ids.WalletTransaction = WalletTransaction;
  ids.Withdrawal = Withdrawal;
  ids.AuditLog = AuditLog;
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

integrationTest("invalid payout option is rejected", async () => {
  const response = await api("/withdrawals", {
    method: "POST", headers: { "Idempotency-Key": "invalid-option-request-01" },
    body: { method: "upi", optionId: "upi_999999", payoutDetails: { upiId: "demo@bank" } }
  });
  assert.equal(response.status, 400);
  assert.match(response.data.message, /Selected payout option is unavailable/);
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


test("payout details are authenticated encrypted at rest", async () => {
  const { encryptPayoutDetails, decryptPayoutDetails } = await import("../src/utils/encryption.js");
  const original = { upiId: "demo@bank" };
  const encrypted = encryptPayoutDetails(original);
  assert.notEqual(encrypted, JSON.stringify(original));
  assert.deepEqual(decryptPayoutDetails(encrypted), original);
});
