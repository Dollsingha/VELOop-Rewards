import express from "express";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import path from "node:path";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";

import authRoutes from "./routes/authRoutes.js";
import walletRoutes from "./routes/walletRoutes.js";
import payoutRoutes from "./routes/payoutRoutes.js";
import withdrawalRoutes from "./routes/withdrawalRoutes.js";
import adminRoutes from "./routes/adminRoutes.js";
import paymentRoutes from "./routes/paymentRoutes.js";

const app = express();
const frontendDist = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../frontend/dist");
const configuredOrigins = [
  ...(process.env.CLIENT_URL || "http://localhost:5173").split(","),
  process.env.RENDER_EXTERNAL_URL
].map(origin => origin?.trim()).filter(Boolean);
const developmentOrigins = process.env.NODE_ENV === "production"
  ? []
  : [
      "http://localhost:5173", "http://127.0.0.1:5173",
      "http://localhost:4173", "http://127.0.0.1:4173"
    ];
const allowedOrigins = [...new Set([...configuredOrigins, ...developmentOrigins])];

if (process.env.TRUST_PROXY === "true") app.set("trust proxy", 1);
app.disable("x-powered-by");
app.use(helmet({
  referrerPolicy: { policy: "strict-origin-when-cross-origin" },
  contentSecurityPolicy: {
    directives: {
      scriptSrc: ["'self'", "https://accounts.google.com/gsi/client", "https://checkout.razorpay.com"],
      styleSrc: ["'self'", "https:", "'unsafe-inline'", "https://accounts.google.com/gsi/style"],
      frameSrc: ["'self'", "https://accounts.google.com/gsi/", "https://api.razorpay.com", "https://checkout.razorpay.com"],
      connectSrc: ["'self'", "https://accounts.google.com/gsi/", "https://api.razorpay.com"]
    }
  }
}));
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
app.use("/api/payments", walletLimiter, paymentRoutes);

if (existsSync(frontendDist)) {
  app.use(express.static(frontendDist, { index: false }));
}

app.use((req, res) => {
  if (req.path.startsWith("/api/")) {
    return res.status(404).json({ success: false, message: "Endpoint not found." });
  }
  if (existsSync(path.join(frontendDist, "index.html"))) {
    return res.sendFile(path.join(frontendDist, "index.html"));
  }
  res.status(404).json({ success: false, message: "Endpoint not found." });
});

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
