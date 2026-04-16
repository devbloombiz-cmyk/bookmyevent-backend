import { OtpSessionModel } from "../models/otp-session.model";

export const otpSessionRepository = {
  createOrReplace: async (payload: {
    mobile: string;
    email?: string;
    otpCode: string;
    expiresAt: Date;
  }) => {
    await OtpSessionModel.updateMany({ mobile: payload.mobile, usedAt: null }, { $set: { usedAt: new Date() } });

    return OtpSessionModel.create({
      mobile: payload.mobile,
      email: payload.email ?? "",
      otpCode: payload.otpCode,
      expiresAt: payload.expiresAt,
      usedAt: null,
      attempts: 0,
    });
  },
  findLatestActiveByMobile: (mobile: string) =>
    OtpSessionModel.findOne({ mobile, usedAt: null }).sort({ createdAt: -1 }),
  incrementAttempts: (id: string) => OtpSessionModel.findByIdAndUpdate(id, { $inc: { attempts: 1 } }),
  markUsed: (id: string) => OtpSessionModel.findByIdAndUpdate(id, { $set: { usedAt: new Date() } }),
};
