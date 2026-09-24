import "dotenv/config";
import app from "./app.js";
import { connectDB } from "./config/db.js";
import { assertPayoutEncryptionKey } from "./utils/encryption.js";

const PORT = process.env.PORT || 5000;

try {
  assertPayoutEncryptionKey();
  await connectDB();
  app.listen(PORT, () => console.log(`API running on port ${PORT}`));
} catch (error) {
  console.error("Startup failed:", error.message);
  process.exit(1);
}


