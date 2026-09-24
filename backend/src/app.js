import express from "express";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";

import authRoutes from "./routes/authRoutes.js";
import walletRoutes from "./routes/walletRoutes.js";
import payoutRoutes from "./routes/payoutRoutes.js";
import withdrawalRoutes from "./routes/withdrawalRoutes.js";
import adminRoutes from "./routes/adminRoutes.js";

const app = express();
const allowedOrigins = (process.env.CLIENT_URL || "http://localhost:5173")
  .split(",").map(origin => origin.trim()).filter(Boolean);

if (process.env.TRUST_PROXY === "true") app.set("trust proxy", 1);
app.disable("x-powered-by");
app.use(helmet());
app.use(cors({
  origin(origin, callback) {
    if (!origin || allowedOrigins.includes(origin)) return callback(null, true);
    const error = new Error("Origin is not allowed.");
    error.statusCode = 403;
    error.expose = true;
    callback(error);
  }
}));
app.use(express.json({ limit: "32kb", strict: true }));

const testMode = process.env.NODE_ENV === "test";
const productionMode = process.env.NODE_ENV === "production";
const authLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: testMode ? 1000 : productionMode ? 20 : 120, standardHeaders: "draft-8", legacyHeaders: false });
const withdrawalLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: testMode ? 1000 : productionMode ? 10 : 30, standardHeaders: "draft-8", legacyHeaders: false });
const walletLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: testMode ? 1000 : productionMode ? 60 : 300, standardHeaders: "draft-8", legacyHeaders: false });

app.get("/api/health", (_req, res) => {
  res.json({ success: true, service: "veloop-wallet-api", status: "ok" });
});
app.use("/api/auth", authLimiter, authRoutes);
app.use("/api/wallet", walletLimiter, walletRoutes);
app.use("/api/payout", walletLimiter, payoutRoutes);
app.use("/api/withdrawals", withdrawalLimiter, withdrawalRoutes);
app.use("/api/admin", withdrawalLimiter, adminRoutes);

app.use((_req, res) => res.status(404).json({ success: false, message: "Endpoint not found." }));

app.use((err, _req, res, _next) => {
  if (res.headersSent) return;
  if (err?.type === "entity.parse.failed") {
    return res.status(400).json({ success: false, message: "Invalid JSON request body." });
  }
  if (err?.name === "ValidationError") {
    return res.status(400).json({ success: false, message: "Request validation failed." });
  }
  if (err?.name === "CastError") {
    return res.status(400).json({ success: false, message: "Invalid identifier." });
  }
  if (err?.code === 11000) {
    return res.status(409).json({ success: false, message: "A record with these details already exists." });
  }
  if (err?.statusCode && err.expose) {
    return res.status(err.statusCode).json({ success: false, message: err.message });
  }
  console.error("Unhandled API error:", err);
  res.status(500).json({ success: false, message: "Internal server error." });
});

export default app;

