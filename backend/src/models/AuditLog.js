import mongoose from "mongoose";

const schema = new mongoose.Schema({
  actorId: { type: mongoose.Schema.Types.ObjectId, ref: "User", index: true },
  action: { type: String, required: true, index: true },
  targetUserId: { type: mongoose.Schema.Types.ObjectId, ref: "User", index: true },
  targetType: String,
  referenceId: { type: String, index: true },
  metadata: { type: mongoose.Schema.Types.Mixed },
  ip: { type: String, maxlength: 64 }
}, { timestamps: true });

schema.index({ createdAt: -1 });
schema.index({ targetUserId: 1, createdAt: -1 });

export default mongoose.model("AuditLog", schema);
