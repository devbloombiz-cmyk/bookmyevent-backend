import { OtpSessionModel } from "../models/otp-session.model";

export const otpSessionRepository = {
  createForEmail: async (payload: {
    email: string;
    otpHash: string;
    expiresAt: Date;
  }) => {
    await OtpSessionModel.updateMany({ email: payload.email, usedAt: null }, { $set: { usedAt: new Date() } });

    return OtpSessionModel.create({
      email: payload.email,
      otpHash: payload.otpHash,
      expiresAt: payload.expiresAt,
      usedAt: null,
      attempts: 0,
    });
  },
  findLatestActiveByEmail: (email: string) => OtpSessionModel.findOne({ email, usedAt: null }).sort({ createdAt: -1 }),
  findLastIssuedByEmail: (email: string) => OtpSessionModel.findOne({ email }).sort({ createdAt: -1 }),
  incrementAttempts: (id: string) => OtpSessionModel.findByIdAndUpdate(id, { $inc: { attempts: 1 } }),
  markUsed: (id: string) => OtpSessionModel.findByIdAndUpdate(id, { $set: { usedAt: new Date() } }),
  deleteById: (id: string) => OtpSessionModel.findByIdAndDelete(id),
};
