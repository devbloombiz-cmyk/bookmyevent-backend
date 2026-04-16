import { RefreshTokenModel } from "../models/refresh-token.model";

export const refreshTokenRepository = {
  create: (payload: { userId: string; tokenHash: string; expiresAt: Date }) => RefreshTokenModel.create(payload),
  findActiveByUserId: (userId: string) => RefreshTokenModel.findOne({ userId, revokedAt: null }).sort({ createdAt: -1 }),
  revokeByUserId: (userId: string) =>
    RefreshTokenModel.updateMany({ userId, revokedAt: null }, { $set: { revokedAt: new Date() } }),
};
