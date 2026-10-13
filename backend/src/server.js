import "dotenv/config";
import app from "./app.js";
import PurchaseOrder from "./models/PurchaseOrder.js";
import RazorpayTestPayout from "./models/RazorpayTestPayout.js";
import { connectDB } from "./config/db.js";
import { assertPayoutEncryptionKey } from "./utils/encryption.js";
import { ensureStreakConfig } from "./services/streakConfigService.js";
import { ensureAssessmentAccount } from "./services/assessmentSeedService.js";

const PORT = process.env.PORT || 5000;

try {
  assertPayoutEncryptionKey();
  await connectDB();
  await RazorpayTestPayout.createIndexes();
  await PurchaseOrder.createIndexes();
  await ensureAssessmentAccount();
  const streakConfig = await ensureStreakConfig();
  console.log(`Streak rewards configured: ${streakConfig.milestoneDays}-day milestone, ${streakConfig.milestoneRewardVES} VEs.`);
  app.listen(PORT, () => console.log(`API running on port ${PORT}`));
} catch (error) {
  console.error("Startup failed:", error.message);
  process.exit(1);
}


