import "dotenv/config";
import mongoose from "mongoose";
import { connectDB } from "../src/config/db.js";
import PayoutOption from "../src/models/PayoutOption.js";

const denominations = [
  [10, 2400], [25, 5800], [50, 10000], [100, 19500],
  [150, 28500], [300, 52500], [500, 80500], [1000, 150000]
];

try {
  await connectDB();
  const result = await PayoutOption.bulkWrite(denominations.map(([payoutValue, requiredAmount]) => ({
    updateOne: {
      filter: { method: "upi", methodId: `upi_${payoutValue}` },
      update: {
        $setOnInsert: {
          method: "upi",
          methodId: `upi_${payoutValue}`,
          name: "UPI",
          type: "BANK_LIKE",
          currency: "VES",
          payoutCurrency: "INR",
          payoutValue,
          requiredAmount,
          requiredDetails: [{ key: "upiId", label: "UPI ID", inputType: "text", required: true }],
          active: true,
          eligibility: { accountStatus: "ACTIVE" }
        }
      },
      upsert: true
    }
  })));
  console.log(`Payout configuration ready; added ${result.upsertedCount} missing UPI options.`);
} catch (error) {
  console.error("Payout configuration seed failed:", error.message);
  process.exitCode = 1;
} finally {
  await mongoose.disconnect();
}

