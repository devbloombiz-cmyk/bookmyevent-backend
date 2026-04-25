import crypto from "crypto";
import { env } from "../config/env";
import { ApiError } from "../utils/api-error";
import { comparePassword, hashPassword } from "../utils/password";
import { signAccessToken, signRefreshToken, verifyRefreshToken } from "../utils/tokens";
import { UserRole } from "../types/domain";
import { otpSessionRepository } from "../repositories/otp-session.repository";
import { refreshTokenRepository } from "../repositories/refresh-token.repository";
import { userRepository } from "../repositories/user.repository";
import { emailOtpService } from "./email-otp.service";

function hashTokenValue(token: string) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

function getRefreshExpiryDate(days = 7) {
  const result = new Date();
  result.setDate(result.getDate() + days);
  return result;
}

function getOtpExpiryDate(minutes = env.OTP_EXPIRY_MINUTES) {
  const result = new Date();
  result.setMinutes(result.getMinutes() + minutes);
  return result;
}

function generateOtpCode() {
  return crypto.randomInt(100000, 1000000).toString();
}

function hashOtpCode(otpCode: string) {
  return crypto.createHash("sha256").update(otpCode).digest("hex");
}

function secureOtpHashMatches(expectedHash: string, providedOtp: string) {
  const providedHash = hashOtpCode(providedOtp);
  const expectedBuffer = Buffer.from(expectedHash, "hex");
  const providedBuffer = Buffer.from(providedHash, "hex");

  if (expectedBuffer.length !== providedBuffer.length) {
    return false;
  }

  return crypto.timingSafeEqual(expectedBuffer, providedBuffer);
}

async function buildAuthSession(user: {
  id: string;
  name: string;
  email: string;
  mobile: string;
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
      mobile: user.mobile,
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

function resolveLoginIdentifier(payload: { identifier?: string; email?: string; mobile?: string }) {
  return (payload.identifier ?? payload.email ?? payload.mobile ?? "").trim();
}

function buildPlaceholderMobileFromEmail(email: string) {
  const digest = crypto.createHash("sha256").update(email).digest("hex").slice(0, 16);
  const numericDigest = digest
    .split("")
    .map((char) => (/[0-9]/.test(char) ? char : String(char.charCodeAt(0) % 10)))
    .join("");
  return `9${numericDigest.slice(0, 9)}`;
}

function buildPlaceholderEmailFromMobile(mobile: string) {
  const safeMobile = mobile.replace(/[^0-9]/g, "");
  return `${safeMobile}@bookmyevent.local`;
}

async function ensureCustomerFromEmail(email: string) {
  const existingUser = await userRepository.findByEmail(email);
  if (existingUser) {
    return existingUser;
  }

  const generatedPassword = crypto.randomBytes(24).toString("hex");
  const passwordHash = await hashPassword(generatedPassword);

  const createdUser = await userRepository.create({
    name: "New Customer",
    email,
    mobile: buildPlaceholderMobileFromEmail(email),
    passwordHash,
    role: "customer",
  });

  return createdUser;
}

async function ensureCustomerFromMobile(mobile: string) {
  const normalizedMobile = mobile.trim();
  const existingUser = await userRepository.findByMobile(normalizedMobile);
  if (existingUser) {
    return existingUser;
  }

  const generatedPassword = crypto.randomBytes(24).toString("hex");
  const passwordHash = await hashPassword(generatedPassword);
  const placeholderEmail = buildPlaceholderEmailFromMobile(normalizedMobile);

  const emailOwner = await userRepository.findByEmail(placeholderEmail);
  const fallbackEmail = emailOwner ? `${normalizedMobile}.${Date.now()}@bookmyevent.local` : placeholderEmail;

  const createdUser = await userRepository.create({
    name: `Customer ${normalizedMobile.slice(-4)}`,
    email: fallbackEmail,
    mobile: normalizedMobile,
    passwordHash,
    role: "customer",
  });

  return createdUser;
}

async function resolveOtpTarget(payload: { identifier?: string; email?: string; mobile?: string }) {
  const identifier = resolveLoginIdentifier(payload);
  if (!identifier) {
    throw new ApiError(400, "OTP identifier is required");
  }

  const isEmailIdentifier = identifier.includes("@");
  if (isEmailIdentifier) {
    return {
      identifier,
      email: identifier.toLowerCase(),
    };
  }

  const user = await ensureCustomerFromMobile(identifier);

  return {
    identifier,
    email: user.email.toLowerCase(),
  };
}

async function loginByRole(payload: {
  identifier?: string;
  email?: string;
  mobile?: string;
  password: string;
  role: UserRole;
}) {
  const identifier = resolveLoginIdentifier(payload);
  if (!identifier) {
    throw new ApiError(400, "Login identifier is required");
  }

  const user = await userRepository.findByEmailOrMobile(identifier);
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

  return buildAuthSession(
    user as unknown as { id: string; name: string; email: string; mobile: string; role: UserRole },
  );
}

async function loginByAllowedRoles(payload: {
  identifier?: string;
  email?: string;
  mobile?: string;
  password: string;
  roles: UserRole[];
}) {
  const identifier = resolveLoginIdentifier(payload);
  if (!identifier) {
    throw new ApiError(400, "Login identifier is required");
  }

  const user = await userRepository.findByEmailOrMobile(identifier);
  if (!user || !payload.roles.includes(user.role as UserRole)) {
    throw new ApiError(401, "Invalid credentials");
  }

  return loginByRole({ identifier, password: payload.password, role: user.role as UserRole });
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

async function requestLoginOtp(payload: { identifier?: string; email?: string; mobile?: string }) {
  const { identifier, email } = await resolveOtpTarget(payload);
  const lastIssuedOtp = await otpSessionRepository.findLastIssuedByEmail(email);

  if (lastIssuedOtp) {
    const secondsSinceLastIssue = Math.floor((Date.now() - lastIssuedOtp.createdAt.getTime()) / 1000);
    if (secondsSinceLastIssue < env.OTP_REQUEST_COOLDOWN_SECONDS) {
      const waitSeconds = env.OTP_REQUEST_COOLDOWN_SECONDS - secondsSinceLastIssue;
      throw new ApiError(429, `Please wait ${waitSeconds}s before requesting a new OTP`);
    }
  }

  const otpCode = generateOtpCode();
  const expiresAt = getOtpExpiryDate(env.OTP_EXPIRY_MINUTES);

  const otpSession = await otpSessionRepository.createForEmail({
    email,
    otpHash: hashOtpCode(otpCode),
    expiresAt,
  });

  try {
    await emailOtpService.sendOtp({
      toEmail: email,
      otpCode,
      expiryMinutes: env.OTP_EXPIRY_MINUTES,
    });
  } catch (error) {
    await otpSessionRepository.deleteById(otpSession.id);
    throw error;
  }

  return {
    identifier,
    email,
    expiresAt,
    cooldownSeconds: env.OTP_REQUEST_COOLDOWN_SECONDS,
  };
}

async function verifyLoginOtp(payload: {
  identifier?: string;
  email?: string;
  mobile?: string;
  otp: string;
}) {
  const { email } = await resolveOtpTarget(payload);
  const otpSession = await otpSessionRepository.findLatestActiveByEmail(email);

  if (!otpSession) {
    throw new ApiError(401, "OTP session not found");
  }

  if (otpSession.expiresAt.getTime() < Date.now()) {
    await otpSessionRepository.deleteById(otpSession.id);
    throw new ApiError(401, "OTP expired");
  }

  if (otpSession.attempts >= 5) {
    throw new ApiError(429, "Too many attempts. Request new OTP");
  }

  if (!secureOtpHashMatches(otpSession.otpHash, payload.otp)) {
    await otpSessionRepository.incrementAttempts(otpSession.id);
    throw new ApiError(401, "Invalid OTP");
  }

  await otpSessionRepository.deleteById(otpSession.id);

  const user = await ensureCustomerFromEmail(email);

  if (!user.isActive) {
    throw new ApiError(403, "Account is deactivated");
  }

  return buildAuthSession(
    user as unknown as { id: string; name: string; email: string; mobile: string; role: UserRole },
  );
}

export const authService = {
  signupCustomer: (payload: { name: string; email: string; mobile: string; password: string }) =>
    signupByRole({ ...payload, role: "customer" }),
  signupVendor: (payload: { name: string; email: string; mobile: string; password: string }) =>
    signupByRole({ ...payload, role: "vendor" }),
  loginCustomer: (payload: { identifier?: string; email?: string; mobile?: string; password: string }) =>
    loginByRole({ ...payload, role: "customer" }),
  loginVendor: (payload: { identifier?: string; email?: string; mobile?: string; password: string }) =>
    loginByRole({ ...payload, role: "vendor" }),
  loginAdmin: (payload: { identifier?: string; email?: string; mobile?: string; password: string }) =>
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
