import mongoose from "mongoose";

const schema = new mongoose.Schema({
  name: { type: String, required: true, trim: true, maxlength: 100 },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  password: { type: String, required: true, select: false },
  role: { type: String, enum: ["USER", "ADMIN"], default: "USER", index: true },
  accountStatus: { type: String, enum: ["ACTIVE", "SUSPENDED"], default: "ACTIVE", index: true }
}, { timestamps: true });

export default mongoose.model("User", schema);

