import type { NextFunction, Request, Response } from "express";
import { env } from "../config/env";
import { auditLogService } from "../services/audit-log.service";
import { resolveAccessProfileForUser } from "../services/pbac.service";
import { userRepository } from "../repositories/user.repository";
import { ApiError } from "../utils/api-error";
import { verifyAccessToken } from "../utils/tokens";
import { parseCookieHeader } from "../utils/cookie";

function extractAccessToken(req: Request): { token: string; fromCookie: boolean } {
  const cookies = parseCookieHeader(req.headers.cookie);
  const cookieToken = cookies[env.AUTH_ACCESS_COOKIE_NAME];
  if (cookieToken) {
    return { token: cookieToken, fromCookie: true };
  }

  const authHeader = req.headers.authorization;
  if (authHeader?.startsWith("Bearer ")) {
    return { token: authHeader.split(" ")[1], fromCookie: false };
  }

  return { token: "", fromCookie: false };
}

function assertCsrf(req: Request) {
  const method = req.method.toUpperCase();
  if (["GET", "HEAD", "OPTIONS"].includes(method)) {
    return;
  }

  const cookies = parseCookieHeader(req.headers.cookie);
  const csrfCookie = cookies[env.AUTH_CSRF_COOKIE_NAME];
  const csrfHeader = String(req.headers["x-csrf-token"] ?? "");

  if (!csrfCookie || !csrfHeader || csrfCookie !== csrfHeader) {
    throw new ApiError(403, "CSRF validation failed");
  }
}

export const requireAuth = async (req: Request, _res: Response, next: NextFunction) => {
  const { token, fromCookie } = extractAccessToken(req);
  if (!token) {
    return next(new ApiError(401, "Missing authorization token"));
  }

  try {
    if (fromCookie) {
      assertCsrf(req);
    }

    const decoded = verifyAccessToken(token);
    const user = await userRepository.findById(decoded.sub);

    if (!user || !user.isActive) {
      auditLogService.write({
        actorUserId: decoded.sub,
        action: "auth.require",
        outcome: "denied",
      });
      return next(new ApiError(401, "Unauthorized user"));
    }

    const accessProfile = await resolveAccessProfileForUser(user.id);

    req.authUser = {
      id: user.id,
      name: user.name ?? undefined,
      email: user.email ?? undefined,
      mobile: user.mobile ?? undefined,
      role: user.role,
      roleKeys: accessProfile.roleKeys,
      permissions: accessProfile.permissions,
      defaultLandingPath: accessProfile.defaultLandingPath,
    };

    return next();
  } catch (error) {
    if (error instanceof ApiError) {
      return next(error);
    }

    return next(new ApiError(401, "Invalid or expired token"));
  }
};

export const attachAuthIfPresent = async (req: Request, _res: Response, next: NextFunction) => {
  const { token, fromCookie } = extractAccessToken(req);
  if (!token) {
    return next();
  }

  try {
    if (fromCookie) {
      assertCsrf(req);
    }

    const decoded = verifyAccessToken(token);
    const user = await userRepository.findById(decoded.sub);

    if (!user || !user.isActive) {
      return next();
    }

    const accessProfile = await resolveAccessProfileForUser(user.id);
    req.authUser = {
      id: user.id,
      name: user.name ?? undefined,
      email: user.email ?? undefined,
      mobile: user.mobile ?? undefined,
      role: user.role,
      roleKeys: accessProfile.roleKeys,
      permissions: accessProfile.permissions,
      defaultLandingPath: accessProfile.defaultLandingPath,
    };

    return next();
  } catch {
    return next();
  }
};
