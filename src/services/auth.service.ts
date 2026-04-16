import crypto from "crypto";
import { ApiError } from "../utils/api-error";
import { comparePassword, hashPassword } from "../utils/password";
import { signAccessToken, signRefreshToken, verifyRefreshToken } from "../utils/tokens";
import { UserRole } from "../types/domain";
import { otpSessionRepository } from "../repositories/otp-session.repository";
import { refreshTokenRepository } from "../repositories/refresh-token.repository";
import { userRepository } from "../repositories/user.repository";

function hashTokenValue(token: string) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

function getRefreshExpiryDate(days = 7) {
  const result = new Date();
  result.setDate(result.getDate() + days);
  return result;
}

function getOtpExpiryDate(minutes = 5) {
  const result = new Date();
  result.setMinutes(result.getMinutes() + minutes);
  return result;
}

function generateOtpCode() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

function fallbackEmailFromMobile(mobile: string) {
  const safeMobile = mobile.replace(/[^0-9+]/g, "");
  return `${safeMobile}@bookmyevent.local`;
}

async function buildAuthSession(user: {
  id: string;
  name: string;
  email: string;
  role: UserRole;
}) {
  const accessToken = signAccessToken({
    sub: user.id,
    email: user.email,
    role: user.role,
  });

  const refreshToken = signRefreshToken({ sub: user.id });

  await refreshTokenRepository.revokeByUserId(user.id);
  await refreshTokenRepository.create({
    userId: user.id,
    tokenHash: hashTokenValue(refreshToken),
    expiresAt: getRefreshExpiryDate(),
  });

  return {
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
    },
    accessToken,
    refreshToken,
  };
}

async function signupByRole(payload: {
  name: string;
  email: string;
  mobile: string;
  password: string;
  role: UserRole;
}) {
  const existingUser = await userRepository.findByEmail(payload.email);
  if (existingUser) {
    throw new ApiError(409, "Email is already registered");
  }

  const passwordHash = await hashPassword(payload.password);
  const user = await userRepository.create({
    name: payload.name,
    email: payload.email,
    mobile: payload.mobile,
    passwordHash,
    role: payload.role,
  });

  return user;
}

async function loginByRole(payload: { email: string; password: string; role: UserRole }) {
  const user = await userRepository.findByEmail(payload.email);
  if (!user || user.role !== payload.role) {
    throw new ApiError(401, "Invalid credentials");
  }

  if (!user.isActive) {
    throw new ApiError(403, "Account is deactivated");
  }

  const isMatch = await comparePassword(payload.password, user.passwordHash);
  if (!isMatch) {
    throw new ApiError(401, "Invalid credentials");
  }

  return buildAuthSession(user as unknown as { id: string; name: string; email: string; role: UserRole });
}

async function loginByAllowedRoles(payload: {
  email: string;
  password: string;
  roles: UserRole[];
}) {
  const user = await userRepository.findByEmail(payload.email);
  if (!user || !payload.roles.includes(user.role as UserRole)) {
    throw new ApiError(401, "Invalid credentials");
  }

  return loginByRole({ email: payload.email, password: payload.password, role: user.role as UserRole });
}

async function refreshAuthToken(refreshToken: string) {
  const decoded = verifyRefreshToken(refreshToken);
  if (decoded.tokenType !== "refresh") {
    throw new ApiError(401, "Invalid refresh token type");
  }

  const tokenRecord = await refreshTokenRepository.findActiveByUserId(decoded.sub);
  if (!tokenRecord) {
    throw new ApiError(401, "Refresh token expired or revoked");
  }

  if (tokenRecord.expiresAt.getTime() < Date.now()) {
    throw new ApiError(401, "Refresh token expired");
  }

  const matches = tokenRecord.tokenHash === hashTokenValue(refreshToken);
  if (!matches) {
    throw new ApiError(401, "Refresh token mismatch");
  }

  const user = await userRepository.findById(decoded.sub);
  if (!user || !user.isActive) {
    throw new ApiError(401, "User not available");
  }

  const newAccessToken = signAccessToken({
    sub: user.id,
    email: user.email,
    role: user.role,
  });

  const newRefreshToken = signRefreshToken({ sub: user.id });

  await refreshTokenRepository.revokeByUserId(user.id);
  await refreshTokenRepository.create({
    userId: user.id,
    tokenHash: hashTokenValue(newRefreshToken),
    expiresAt: getRefreshExpiryDate(),
  });

  return {
    accessToken: newAccessToken,
    refreshToken: newRefreshToken,
  };
}

async function requestLoginOtp(payload: { mobile: string; email?: string }) {
  const mobile = payload.mobile.trim();
  const code = generateOtpCode();
  const expiresAt = getOtpExpiryDate();

  const otpSession = await otpSessionRepository.createOrReplace({
    mobile,
    email: payload.email,
    otpCode: code,
    expiresAt,
  });

  const existingUser = await userRepository.findByMobile(mobile);

  // eslint-disable-next-line no-console
  console.log(`\n================ OTP LOGIN ================\nMOBILE: ${mobile}\nOTP: ${code}\nEXPIRES: ${expiresAt.toISOString()}\n===========================================\n`);

  return {
    challengeId: otpSession.id,
    mobile,
    expiresAt,
    existingUser: Boolean(existingUser),
  };
}

async function verifyLoginOtp(payload: { mobile: string; otp: string }) {
  const mobile = payload.mobile.trim();
  const otpSession = await otpSessionRepository.findLatestActiveByMobile(mobile);

  if (!otpSession) {
    throw new ApiError(401, "OTP session not found");
  }

  if (otpSession.expiresAt.getTime() < Date.now()) {
    throw new ApiError(401, "OTP expired");
  }

  if (otpSession.attempts >= 5) {
    throw new ApiError(429, "Too many attempts. Request new OTP");
  }

  if (otpSession.otpCode !== payload.otp) {
    await otpSessionRepository.incrementAttempts(otpSession.id);
    throw new ApiError(401, "Invalid OTP");
  }

  await otpSessionRepository.markUsed(otpSession.id);

  let user = await userRepository.findByMobile(mobile);

  if (!user) {
    const generatedPassword = crypto.randomBytes(16).toString("hex");
    const passwordHash = await hashPassword(generatedPassword);
    user = await userRepository.create({
      name: `Customer ${mobile.slice(-4)}`,
      email: fallbackEmailFromMobile(mobile),
      mobile,
      passwordHash,
      role: "customer",
    });
  }

  if (!user.isActive) {
    throw new ApiError(403, "Account is deactivated");
  }

  return buildAuthSession(user as unknown as { id: string; name: string; email: string; role: UserRole });
}

export const authService = {
  signupCustomer: (payload: { name: string; email: string; mobile: string; password: string }) =>
    signupByRole({ ...payload, role: "customer" }),
  signupVendor: (payload: { name: string; email: string; mobile: string; password: string }) =>
    signupByRole({ ...payload, role: "vendor" }),
  loginCustomer: (payload: { email: string; password: string }) =>
    loginByRole({ ...payload, role: "customer" }),
  loginVendor: (payload: { email: string; password: string }) =>
    loginByRole({ ...payload, role: "vendor" }),
  loginAdmin: (payload: { email: string; password: string }) =>
    loginByAllowedRoles({
      ...payload,
      roles: ["super_admin", "vendor_admin", "accounts_admin"],
    }),
  requestLoginOtp,
  verifyLoginOtp,
  refreshAuthToken,
  logout: (userId: string) => refreshTokenRepository.revokeByUserId(userId),
  forgotPasswordPlaceholder: async (email: string) => ({ queued: true, email }),
};
