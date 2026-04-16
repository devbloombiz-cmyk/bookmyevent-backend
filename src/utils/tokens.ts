import jwt, { SignOptions } from "jsonwebtoken";
import { env } from "../config/env";
import { UserRole } from "../types/domain";

export type AccessTokenPayload = {
  sub: string;
  role: UserRole;
  email: string;
  tokenType: "access";
};

export type RefreshTokenPayload = {
  sub: string;
  tokenType: "refresh";
};

const accessSignOptions: SignOptions = {
  expiresIn: env.JWT_ACCESS_EXPIRES_IN as SignOptions["expiresIn"],
};

const refreshSignOptions: SignOptions = {
  expiresIn: env.JWT_REFRESH_EXPIRES_IN as SignOptions["expiresIn"],
};

export function signAccessToken(payload: Omit<AccessTokenPayload, "tokenType">) {
  return jwt.sign({ ...payload, tokenType: "access" }, env.JWT_SECRET, accessSignOptions);
}

export function signRefreshToken(payload: Omit<RefreshTokenPayload, "tokenType">) {
  return jwt.sign({ ...payload, tokenType: "refresh" }, env.JWT_REFRESH_SECRET, refreshSignOptions);
}

export function verifyAccessToken(token: string) {
  return jwt.verify(token, env.JWT_SECRET) as AccessTokenPayload;
}

export function verifyRefreshToken(token: string) {
  return jwt.verify(token, env.JWT_REFRESH_SECRET) as RefreshTokenPayload;
}
