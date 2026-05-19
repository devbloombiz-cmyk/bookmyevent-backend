import crypto from "crypto";
import { PermissionKeys, type PermissionKey } from "../config/permissions";
import { env } from "../config/env";
import { ApiError } from "../utils/api-error";
import { comparePassword, hashPassword } from "../utils/password";
import { signAccessToken, signRefreshToken, verifyRefreshToken } from "../utils/tokens";
import { UserRole } from "../types/domain";
import { logger } from "../config/logger";
import { otpSessionRepository } from "../repositories/otp-session.repository";
import { refreshTokenRepository } from "../repositories/refresh-token.repository";
import { userRepository } from "../repositories/user.repository";
import { otpNotificationService } from "./notifications/otp/otp-notification.service";
import { hasPermission, resolveAccessProfileForUser } from "./pbac.service";
import { durationToFutureDate } from "../utils/duration";
import { vendorRepository } from "../repositories/vendor.repository";
import { venueOwnerRepository } from "../repositories/venue-owner.repository";

function hashTokenValue(token: string) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

function getRefreshExpiryDate() {
  return durationToFutureDate(env.JWT_REFRESH_EXPIRES_IN, 60 * 60 * 24 * 90);
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
  email?: string;
  mobile?: string;
  role: UserRole;
}) {
  const accessProfile = await resolveAccessProfileForUser(user.id);

  const accessToken = signAccessToken({
    sub: user.id,
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
    permissions: accessProfile.permissions,
    roleKeys: accessProfile.roleKeys,
    navigation: {
      defaultLandingPath: accessProfile.defaultLandingPath,
    },
    tokens: {
      accessToken,
      refreshToken,
    },
  };
}

async function signupByRole(payload: {
  name: string;
  email: string;
  mobile: string;
  password: string;
  role: UserRole;
}) {
  const normalizedEmail = payload.email.trim().toLowerCase();
  const normalizedMobile = payload.mobile.trim();

  const existingUserByEmail = await userRepository.findByEmail(normalizedEmail);
  if (existingUserByEmail) {
    throw new ApiError(409, "Email is already registered");
  }

  const existingUserByMobile = await userRepository.findByMobile(normalizedMobile);
  if (existingUserByMobile) {
    throw new ApiError(409, "Mobile number is already registered");
  }

  const passwordHash = await hashPassword(payload.password);
  const user = await userRepository.create({
    name: payload.name,
    email: normalizedEmail,
    mobile: normalizedMobile,
    passwordHash,
    role: payload.role,
  });

  return user;
}

function resolveLoginIdentifier(payload: { identifier?: string; email?: string; mobile?: string }) {
  return (payload.identifier ?? payload.email ?? payload.mobile ?? "").trim();
}

async function ensureCustomerFromEmail(email: string) {
  const normalizedEmail = email.trim().toLowerCase();
  const existingUser = await userRepository.findByEmail(normalizedEmail);
  if (existingUser) {
    return existingUser;
  }

  const createdUser = await userRepository.create({
    name: normalizedEmail.split("@")[0] || "New Customer",
    email: normalizedEmail,
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

  const createdUser = await userRepository.create({
    name: `Customer ${normalizedMobile.slice(-4)}`,
    mobile: normalizedMobile,
    role: "customer",
  });

  return createdUser;
}

type OtpTarget = {
  identifier: string;
  otpLookupKey: string;
  loginMode: "email" | "mobile";
  deliveryChannel: "email" | "whatsapp";
  deliveryAddress: string;
  emailForDelivery?: string;
  email?: string;
  mobile?: string;
  authUser?: {
    id: string;
    name: string;
    email?: string;
    mobile?: string;
    role: UserRole;
    isActive: boolean;
  };
};

type OtpPortal = "user" | "vendor" | "venue-owner" | "admin";

type OtpAuditMeta = {
  ip?: string;
  userAgent?: string;
};

function resolveOtpPortal(value?: string): OtpPortal {
  if (value === "vendor" || value === "venue-owner" || value === "admin") {
    return value;
  }

  return "user";
}

function isEmailIdentifier(identifier: string) {
  const normalized = identifier.trim();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized);
}

function getPortalPermission(portal: OtpPortal): PermissionKey | null {
  if (portal === "vendor") {
    return PermissionKeys.WorkspaceVendorAccess;
  }

  if (portal === "venue-owner") {
    return PermissionKeys.WorkspaceVenueOwnerAccess;
  }

  if (portal === "admin") {
    return PermissionKeys.WorkspaceAdminAccess;
  }

  return null;
}

function maskIdentifier(identifier: string) {
  const source = String(identifier || "").trim();
  if (!source) {
    return "unknown";
  }

  if (source.includes("@")) {
    const [name, domain] = source.split("@");
    const visible = name.slice(0, 2);
    return `${visible}***@${domain || "***"}`;
  }

  return `${source.slice(0, 2)}***${source.slice(-2)}`;
}

async function resolvePendingApprovalMessage(user: {
  id: string;
  role: UserRole;
  email?: string;
  mobile?: string;
}) {
  if (user.role === "vendor") {
    const vendor =
      (await vendorRepository.findByUserId(user.id)) ||
      (await vendorRepository.findByEmailOrMobile(user.email, user.mobile));

    if (vendor?.approvalStatus === "pending") {
      return "Vendor account is pending admin approval. Please wait for approval before login.";
    }
  }

  if (user.role === "venue_owner") {
    const venueOwner =
      (await venueOwnerRepository.findByUserId(user.id)) ||
      (await venueOwnerRepository.findByEmailOrMobile(user.email, user.mobile));

    if (venueOwner?.approvalStatus === "pending") {
      return "Venue owner account is pending admin approval. Please wait for approval before login.";
    }
  }

  return "Account is deactivated";
}

async function resolveOtpTarget(payload: {
  identifier?: string;
  email?: string;
  mobile?: string;
  portal?: string;
}) {
  const identifier = resolveLoginIdentifier(payload);
  if (!identifier) {
    throw new ApiError(400, "OTP identifier is required");
  }

  const portal = resolveOtpPortal(payload.portal);
  const requiredPortalPermission = getPortalPermission(portal);

  if (requiredPortalPermission) {
    const existingUser = await userRepository.findByEmailOrMobile(identifier);
    if (!existingUser) {
      throw new ApiError(401, "Account not found for selected portal");
    }

    if (!existingUser.isActive) {
      const message = await resolvePendingApprovalMessage({
        id: existingUser.id,
        role: existingUser.role,
        email: existingUser.email ?? undefined,
        mobile: existingUser.mobile ?? undefined,
      });
      throw new ApiError(403, message);
    }

    const accessProfile = await resolveAccessProfileForUser(existingUser.id);
    if (!hasPermission(accessProfile.permissions, requiredPortalPermission)) {
      throw new ApiError(403, "Forbidden");
    }

    const normalizedEmail = existingUser.email?.trim().toLowerCase() || "";
    const normalizedMobile = existingUser.mobile?.trim() || "";
    const wantsEmailOtp = isEmailIdentifier(identifier);

    if (wantsEmailOtp && !normalizedEmail) {
      throw new ApiError(400, "Selected portal account does not have a registered email.");
    }

    if (!wantsEmailOtp && !normalizedMobile) {
      throw new ApiError(400, "Selected portal account does not have a registered mobile number.");
    }

    const otpLookupKey = wantsEmailOtp ? normalizedEmail : `mobile:${normalizedMobile}`;
    const deliveryChannel = wantsEmailOtp ? "email" : "whatsapp";
    const deliveryAddress = wantsEmailOtp ? normalizedEmail : normalizedMobile;

    return {
      identifier,
      otpLookupKey,
      loginMode: wantsEmailOtp ? "email" : "mobile",
      deliveryChannel,
      deliveryAddress,
      emailForDelivery: wantsEmailOtp ? normalizedEmail : undefined,
      email: normalizedEmail,
      mobile: normalizedMobile || undefined,
      authUser: {
        id: existingUser.id,
        name: existingUser.name,
        email: existingUser.email ?? undefined,
        mobile: existingUser.mobile ?? undefined,
        role: existingUser.role,
        isActive: existingUser.isActive,
      },
    } satisfies OtpTarget;
  }

  const identifierIsEmail = isEmailIdentifier(identifier);
  if (identifierIsEmail) {
    const normalizedEmail = identifier.toLowerCase();
    return {
      identifier,
      otpLookupKey: normalizedEmail,
      loginMode: "email" as const,
      deliveryChannel: "email" as const,
      deliveryAddress: normalizedEmail,
      emailForDelivery: normalizedEmail,
      email: normalizedEmail,
    } satisfies OtpTarget;
  }

  const mobile = identifier.trim();
  return {
    identifier,
    otpLookupKey: `mobile:${mobile}`,
    loginMode: "mobile" as const,
    deliveryChannel: "whatsapp" as const,
    deliveryAddress: mobile,
    mobile,
  } satisfies OtpTarget;
}

async function loginByRequiredPermission(payload: {
  identifier?: string;
  email?: string;
  mobile?: string;
  password: string;
  permission: PermissionKey;
}) {
  const identifier = resolveLoginIdentifier(payload);
  if (!identifier) {
    throw new ApiError(400, "Login identifier is required");
  }

  const user = await userRepository.findByEmailOrMobile(identifier);
  if (!user) {
    throw new ApiError(401, "Invalid credentials");
  }

  if (!user.isActive) {
    const message = await resolvePendingApprovalMessage({
      id: user.id,
      role: user.role,
      email: user.email ?? undefined,
      mobile: user.mobile ?? undefined,
    });
    throw new ApiError(403, message);
  }

  if (!user.passwordHash) {
    throw new ApiError(401, "Password login is not enabled for this account");
  }

  const isMatch = await comparePassword(payload.password, user.passwordHash);
  if (!isMatch) {
    throw new ApiError(401, "Invalid credentials");
  }

  const accessProfile = await resolveAccessProfileForUser(user.id);
  if (!hasPermission(accessProfile.permissions, payload.permission)) {
    throw new ApiError(403, "Forbidden");
  }

  return buildAuthSession(
    user as unknown as { id: string; name: string; email?: string; mobile?: string; role: UserRole },
  );
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
  });

  const newRefreshToken = signRefreshToken({ sub: user.id });

  await refreshTokenRepository.revokeByUserId(user.id);
  await refreshTokenRepository.create({
    userId: user.id,
    tokenHash: hashTokenValue(newRefreshToken),
    expiresAt: getRefreshExpiryDate(),
  });

  return {
    tokens: {
      accessToken: newAccessToken,
      refreshToken: newRefreshToken,
    },
  };
}

async function requestLoginOtp(
  payload: { identifier?: string; email?: string; mobile?: string; portal?: string },
  auditMeta?: OtpAuditMeta,
) {
  const portal = resolveOtpPortal(payload.portal);
  const maskedIdentifier = maskIdentifier(resolveLoginIdentifier(payload));

  logger.info(
    {
      event: "auth.otp.request.started",
      portal,
      identifier: maskedIdentifier,
      ip: auditMeta?.ip,
      userAgent: auditMeta?.userAgent,
    },
    "OTP request started",
  );

  const target = await resolveOtpTarget(payload);
  const lastIssuedOtp = await otpSessionRepository.findLastIssuedByEmail(target.otpLookupKey);

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
    email: target.otpLookupKey,
    otpHash: hashOtpCode(otpCode),
    expiresAt,
  });

  try {
    const deliveryResult = await otpNotificationService.sendLoginOtp({
      channel: target.deliveryChannel,
      to: target.deliveryAddress,
      otpCode,
      expiryMinutes: env.OTP_EXPIRY_MINUTES,
    });

    logger.info(
      {
        event: "auth.otp.delivery.succeeded",
        portal,
        identifier: maskedIdentifier,
        channel: deliveryResult.deliveryChannel,
      },
      "OTP delivery succeeded",
    );
  } catch (error) {
    logger.warn(
      {
        event: "auth.otp.request.failed",
        portal,
        identifier: maskedIdentifier,
        ip: auditMeta?.ip,
        userAgent: auditMeta?.userAgent,
      },
      "OTP request failed while sending code",
    );
    await otpSessionRepository.deleteById(otpSession.id);
    throw error;
  }

  logger.info(
    {
      event: "auth.otp.request.succeeded",
      portal,
      identifier: maskedIdentifier,
      ip: auditMeta?.ip,
      userAgent: auditMeta?.userAgent,
    },
    "OTP request completed",
  );

  return {
    identifier: target.identifier,
    email: target.emailForDelivery || "",
    mobile: target.deliveryChannel === "whatsapp" ? target.deliveryAddress : "",
    deliveryChannel: target.deliveryChannel,
    expiresAt,
    cooldownSeconds: env.OTP_REQUEST_COOLDOWN_SECONDS,
  };
}

async function verifyLoginOtp(
  payload: {
    identifier?: string;
    email?: string;
    mobile?: string;
    otp: string;
    portal?: string;
  },
  auditMeta?: OtpAuditMeta,
) {
  const portal = resolveOtpPortal(payload.portal);
  const maskedIdentifier = maskIdentifier(resolveLoginIdentifier(payload));

  const target = await resolveOtpTarget(payload);
  const otpSession = await otpSessionRepository.findLatestActiveByEmail(target.otpLookupKey);

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
    logger.warn(
      {
        event: "auth.otp.verify.failed",
        portal,
        identifier: maskedIdentifier,
        reason: "invalid_otp",
        ip: auditMeta?.ip,
        userAgent: auditMeta?.userAgent,
      },
      "OTP verification failed",
    );
    throw new ApiError(401, "Invalid OTP");
  }

  await otpSessionRepository.deleteById(otpSession.id);

  const user =
    target.authUser ||
    (target.loginMode === "email"
      ? await ensureCustomerFromEmail(target.email || "")
      : await ensureCustomerFromMobile(target.mobile || ""));

  if (!user.isActive) {
    const message = await resolvePendingApprovalMessage({
      id: user.id,
      role: user.role,
      email: user.email ?? undefined,
      mobile: user.mobile ?? undefined,
    });
    throw new ApiError(403, message);
  }

  logger.info(
    {
      event: "auth.otp.verify.succeeded",
      portal,
      identifier: maskedIdentifier,
      userId: user.id,
      role: user.role,
      ip: auditMeta?.ip,
      userAgent: auditMeta?.userAgent,
    },
    "OTP verification succeeded",
  );

  return buildAuthSession(
    user as unknown as { id: string; name: string; email?: string; mobile?: string; role: UserRole },
  );
}

export const authService = {
  signupCustomer: (payload: { name: string; email: string; mobile: string; password: string }) =>
    signupByRole({ ...payload, role: "customer" }),
  signupVendor: (payload: { name: string; email: string; mobile: string; password: string }) =>
    signupByRole({ ...payload, role: "vendor" }),
  signupVenueOwner: (payload: { name: string; email: string; mobile: string; password: string }) =>
    signupByRole({ ...payload, role: "venue_owner" }),
  loginCustomer: (payload: { identifier?: string; email?: string; mobile?: string; password: string }) =>
    loginByRequiredPermission({
      ...payload,
      permission: PermissionKeys.WorkspaceCustomerAccess,
    }),
  loginVendor: (payload: { identifier?: string; email?: string; mobile?: string; password: string }) =>
    loginByRequiredPermission({
      ...payload,
      permission: PermissionKeys.WorkspaceVendorAccess,
    }),
  loginVenueOwner: (payload: { identifier?: string; email?: string; mobile?: string; password: string }) =>
    loginByRequiredPermission({
      ...payload,
      permission: PermissionKeys.WorkspaceVenueOwnerAccess,
    }),
  loginAdmin: (payload: { identifier?: string; email?: string; mobile?: string; password: string }) =>
    loginByRequiredPermission({
      ...payload,
      permission: PermissionKeys.WorkspaceAdminAccess,
    }),
  requestLoginOtp,
  verifyLoginOtp,
  refreshAuthToken,
  logout: (userId: string) => refreshTokenRepository.revokeByUserId(userId),
  forgotPasswordPlaceholder: async (email: string) => ({ queued: true, email }),
};
