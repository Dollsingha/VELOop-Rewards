// Disposable local UI QA fixture. Never uses the hosted/development database.
import crypto from "node:crypto";
process.env.NODE_ENV = "test";
process.env.CLIENT_URL = "http://127.0.0.1:5057";
process.env.MONGO_URI = "mongodb://127.0.0.1:27017/veloop_ui_qa_test?replicaSet=rs0";
process.env.JWT_SECRET = crypto.randomBytes(32).toString("hex");
process.env.PAYOUT_DETAILS_ENCRYPTION_KEY = crypto.randomBytes(32).toString("hex");
process.env.ASSESSMENT_REVIEW_ENABLED = "true";
process.env.ASSESSMENT_DB_NAME = "veloop_ui_qa_test";
process.env.ASSESSMENT_REVIEW_EMAIL = "ui.qa@example.test";
process.env.ASSESSMENT_REVIEW_PASSWORD = "Local-UI-QA-Only-Password-12345";
const { connectDB } = await import("../src/config/db.js");
await connectDB();
const { ensureAssessmentAccount } = await import("../src/services/assessmentSeedService.js");
await ensureAssessmentAccount();
const { default: PayoutOption } = await import("../src/models/PayoutOption.js");
await PayoutOption.updateOne({ methodId: "upi_10" }, { $setOnInsert: {
  methodId: "upi_10", method: "upi", name: "UPI", type: "BANK_LIKE",
  currency: "VES", payoutCurrency: "INR", payoutValue: 10, requiredAmount: 2400,
  requiredDetails: [{ key: "upiId", label: "UPI ID", inputType: "text", required: true }], active: true
} }, { upsert: true });
const { ensureStreakConfig } = await import("../src/services/streakConfigService.js");
await ensureStreakConfig();
const { default: app } = await import("../src/app.js");
const server = app.listen(5057, "127.0.0.1", () => console.log("Isolated UI QA ready at http://127.0.0.1:5057"));
process.on("SIGINT", () => server.close(() => process.exit(0)));
