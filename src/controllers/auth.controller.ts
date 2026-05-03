import crypto from "crypto";
import type { Response } from "express";
import { env } from "../config/env";
import { authService } from "../services/auth.service";
import { sendSuccess } from "../utils/api-response";
import { asyncHandler } from "../utils/async-handler";
import { parseCookieHeader, serializeCookie } from "../utils/cookie";
import { durationToSeconds } from "../utils/duration";
import { verifyRefreshToken } from "../utils/tokens";

const accessCookieMaxAgeSeconds = durationToSeconds(env.JWT_ACCESS_EXPIRES_IN, 60 * 15);
const refreshCookieMaxAgeSeconds = durationToSeconds(env.JWT_REFRESH_EXPIRES_IN, 60 * 60 * 24 * 90);

function getCookieBaseOptions() {
  return {
    secure: env.AUTH_COOKIE_SECURE,
    sameSite: "Strict" as const,
    path: "/",
    domain: env.AUTH_COOKIE_DOMAIN,
  };
}

function setAuthCookies(res: Response, tokens: { accessToken: string; refreshToken: string }) {
  const base = getCookieBaseOptions();
  const csrfToken = crypto.randomBytes(24).toString("hex");

  res.append(
    "Set-Cookie",
    serializeCookie(env.AUTH_ACCESS_COOKIE_NAME, tokens.accessToken, {
      ...base,
      httpOnly: true,
      maxAge: accessCookieMaxAgeSeconds,
    }),
  );

  res.append(
    "Set-Cookie",
    serializeCookie(env.AUTH_REFRESH_COOKIE_NAME, tokens.refreshToken, {
      ...base,
      httpOnly: true,
      maxAge: refreshCookieMaxAgeSeconds,
    }),
  );

  res.append(
    "Set-Cookie",
    serializeCookie(env.AUTH_CSRF_COOKIE_NAME, csrfToken, {
      ...base,
      httpOnly: false,
      maxAge: refreshCookieMaxAgeSeconds,
    }),
  );

  return csrfToken;
}

function clearAuthCookies(res: Response) {
  const base = getCookieBaseOptions();

  res.append(
    "Set-Cookie",
    serializeCookie(env.AUTH_ACCESS_COOKIE_NAME, "", {
      ...base,
      httpOnly: true,
      maxAge: 0,
    }),
  );
  res.append(
    "Set-Cookie",
    serializeCookie(env.AUTH_REFRESH_COOKIE_NAME, "", {
      ...base,
      httpOnly: true,
      maxAge: 0,
    }),
  );
  res.append(
    "Set-Cookie",
    serializeCookie(env.AUTH_CSRF_COOKIE_NAME, "", {
      ...base,
      httpOnly: false,
      maxAge: 0,
    }),
  );
}

export const authController = {
  signupCustomer: asyncHandler(async (req, res) => {
    const user = await authService.signupCustomer(req.body);
    return sendSuccess(res, "Customer signup successful", { user }, 201);
  }),

  signupVendor: asyncHandler(async (req, res) => {
    const user = await authService.signupVendor(req.body);
    return sendSuccess(res, "Vendor signup successful", { user }, 201);
  }),

  signupVenueOwner: asyncHandler(async (req, res) => {
    const user = await authService.signupVenueOwner(req.body);
    return sendSuccess(res, "Venue owner signup successful", { user }, 201);
  }),

  loginCustomer: asyncHandler(async (req, res) => {
    const result = await authService.loginCustomer(req.body);
    const csrfToken = setAuthCookies(res, result.tokens);
    return sendSuccess(res, "Customer login successful", {
      user: result.user,
      permissions: result.permissions,
      roleKeys: result.roleKeys,
      navigation: result.navigation,
      csrfToken,
    });
  }),

  loginVendor: asyncHandler(async (req, res) => {
    const result = await authService.loginVendor(req.body);
    const csrfToken = setAuthCookies(res, result.tokens);
    return sendSuccess(res, "Vendor login successful", {
      user: result.user,
      permissions: result.permissions,
      roleKeys: result.roleKeys,
      navigation: result.navigation,
      csrfToken,
    });
  }),

  loginVenueOwner: asyncHandler(async (req, res) => {
    const result = await authService.loginVenueOwner(req.body);
    const csrfToken = setAuthCookies(res, result.tokens);
    return sendSuccess(res, "Venue owner login successful", {
      user: result.user,
      permissions: result.permissions,
      roleKeys: result.roleKeys,
      navigation: result.navigation,
      csrfToken,
    });
  }),

  loginAdmin: asyncHandler(async (req, res) => {
    const result = await authService.loginAdmin(req.body);
    const csrfToken = setAuthCookies(res, result.tokens);
    return sendSuccess(res, "Admin login successful", {
      user: result.user,
      permissions: result.permissions,
      roleKeys: result.roleKeys,
      navigation: result.navigation,
      csrfToken,
    });
  }),

  requestOtp: asyncHandler(async (req, res) => {
    const result = await authService.requestLoginOtp(req.body);
    return sendSuccess(res, "OTP sent to email", result);
  }),

  verifyOtp: asyncHandler(async (req, res) => {
    const result = await authService.verifyLoginOtp(req.body);
    const csrfToken = setAuthCookies(res, result.tokens);
    return sendSuccess(res, "OTP verified", {
      user: result.user,
      permissions: result.permissions,
      roleKeys: result.roleKeys,
      navigation: result.navigation,
      csrfToken,
    });
  }),

  refreshToken: asyncHandler(async (req, res) => {
    const cookies = parseCookieHeader(req.headers.cookie);
    const refreshToken =
      cookies[env.AUTH_REFRESH_COOKIE_NAME] ?? String(req.body.refreshToken ?? "");
    const result = await authService.refreshAuthToken(refreshToken);
    const csrfToken = setAuthCookies(res, result.tokens);
    return sendSuccess(res, "Token refreshed", { csrfToken });
  }),

  logout: asyncHandler(async (req, res) => {
    const authUserId = req.authUser?.id;
    if (authUserId) {
      await authService.logout(authUserId);
    } else {
      const cookies = parseCookieHeader(req.headers.cookie);
      const refreshToken = cookies[env.AUTH_REFRESH_COOKIE_NAME];
      if (refreshToken) {
        try {
          const decoded = verifyRefreshToken(refreshToken);
          await authService.logout(decoded.sub);
        } catch {
          // Invalid refresh token is treated as already logged out.
        }
      }
    }

    clearAuthCookies(res);
    return sendSuccess(res, "Logout successful", {});
  }),

  getSession: asyncHandler(async (req, res) => {
    const authUser = req.authUser;
    if (!authUser) {
      return sendSuccess(res, "Session not found", { session: null });
    }

    return sendSuccess(res, "Session fetched", {
      session: {
        user: {
          id: authUser.id,
          name: authUser.name,
          email: authUser.email,
          mobile: authUser.mobile,
          role: authUser.role,
        },
        permissions: authUser.permissions,
        roleKeys: authUser.roleKeys,
        navigation: {
          defaultLandingPath: authUser.defaultLandingPath,
        },
      },
    });
  }),

  forgotPassword: asyncHandler(async (req, res) => {
    await authService.forgotPasswordPlaceholder(req.body.email);
    return sendSuccess(res, "Forgot password placeholder queued", {});
  }),
};
