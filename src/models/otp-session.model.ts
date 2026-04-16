import { Schema, model } from "mongoose";

const otpSessionSchema = new Schema(
  {
    mobile: { type: String, required: true, trim: true },
    otpCode: { type: String, required: true, trim: true },
    email: { type: String, default: "", trim: true, lowercase: true },
    expiresAt: { type: Date, required: true },
    usedAt: { type: Date, default: null },
    attempts: { type: Number, default: 0, min: 0 },
  },
  { timestamps: true },
);

otpSessionSchema.index({ mobile: 1, createdAt: -1 });
otpSessionSchema.index({ expiresAt: 1 });

export const OtpSessionModel = model("OtpSession", otpSessionSchema);
