import mongoose from "mongoose";

const schema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
  packageId: { type: String, required: true, trim: true, maxlength: 80 },
  vesAmount: { type: Number, required: true, min: 1, validate: Number.isSafeInteger },
  amountPaise: { type: Number, required: true, min: 100, validate: Number.isSafeInteger },
  currency: { type: String, enum: ["INR"], default: "INR", required: true },
  razorpayOrderId: { type: String, required: true, unique: true },
  razorpayPaymentId: { type: String, unique: true, sparse: true },
  status: { type: String, enum: ["CREATED", "PAID", "FAILED"], default: "CREATED", index: true },
  creditedAt: { type: Date }
}, { timestamps: true });

schema.index({ userId: 1, createdAt: -1 });

export default mongoose.model("PurchaseOrder", schema);
