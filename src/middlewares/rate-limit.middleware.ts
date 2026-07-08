import { createHash } from "node:crypto";
import rateLimit, { ipKeyGenerator } from "express-rate-limit";
import type { Request, Response, NextFunction } from "express";
import { env } from "../config/env";
import { logger } from "../config/logger";

function readCookieFromHeader(cookieHeader: string, cookieName: string): string {
  const parts = cookieHeader.split(";");

  for (const rawPart of parts) {
    const part = rawPart.trim();
    if (!part.startsWith(`${cookieName}=`)) {
      continue;
    }

    return part.slice(cookieName.length + 1);
  }

  return "";
}

function hashIdentity(value: string): string {
  return createHash("sha256").update(value).digest("hex").slice(0, 20);
}

export function buildRateLimitKey(req: Request): string {
  // Check cookie-based auth
  const cookieHeader = String(req.headers.cookie ?? "");
  const accessToken = readCookieFromHeader(cookieHeader, env.AUTH_ACCESS_COOKIE_NAME);
  const refreshToken = readCookieFromHeader(cookieHeader, env.AUTH_REFRESH_COOKIE_NAME);

  if (accessToken || refreshToken) {
    return `auth:${hashIdentity(`${accessToken}:${refreshToken}`)}`;
  }

  // Check Bearer header-based auth
  const authHeader = req.headers.authorization;
  if (authHeader?.startsWith("Bearer ")) {
    const token = authHeader.split(" ")[1];
    if (token) {
      return `auth:${hashIdentity(token)}`;
    }
  }

  // Normalize IP address (no User-Agent to avoid NAT collisions)
  const clientIp = ipKeyGenerator(req.ip || "127.0.0.1");
  return `ip:${hashIdentity(clientIp)}`;
}

export function buildAuthRateLimitKey(req: Request): string {
  const body = req.body as { email?: string; mobile?: string; identifier?: string } | undefined;
  const identifier = body?.email ?? body?.mobile ?? body?.identifier;
  if (identifier && typeof identifier === "string" && identifier.trim()) {
    return `auth-action:${hashIdentity(identifier.trim().toLowerCase())}`;
  }
  const clientIp = ipKeyGenerator(req.ip || "127.0.0.1");
  return `auth-ip:${hashIdentity(clientIp)}`;
}

/* eslint-disable @typescript-eslint/no-explicit-any */
interface RateLimitOptions {
  windowMs: number;
  limit?: any;
  max?: any;
  statusCode?: number;
  authKey?: string;
}
/* eslint-enable @typescript-eslint/no-explicit-any */

function logRateLimitHit(req: Request, limiterName: string, options: RateLimitOptions) {
  const retryAfterSeconds = Math.max(1, Math.ceil((options.windowMs || 60000) / 1000));

  const headers: Record<string, string> = {};
  const interestedHeaders = [
    "user-agent",
    "x-forwarded-for",
    "x-real-ip",
    "x-bme-internal-secret",
    "authorization",
    "cookie",
  ];
  for (const h of interestedHeaders) {
    if (req.headers[h]) {
      headers[h] = String(req.headers[h]);
    }
  }

  if (headers["authorization"]) {
    headers["authorization"] = headers["authorization"].substring(0, 15) + "...";
  }
  if (headers["cookie"]) {
    headers["cookie"] = headers["cookie"].substring(0, 30) + "...";
  }

  let generatedKey: string;
  try {
    generatedKey = buildRateLimitKey(req);
  } catch (err) {
    generatedKey = `error:${String(err)}`;
  }

  const authKey = options.authKey || undefined;

  logger.warn(
    {
      limiter: limiterName,
      path: req.path,
      method: req.method,
      ip: req.ip,
      ips: req.ips,
      headers,
      key: generatedKey,
      authKey,
      windowMs: options.windowMs,
      limit: options.limit || options.max,
      retryAfterSeconds,
    },
    `Rate limit exceeded on ${limiterName}`,
  );
}

// 1. GET Rate Limiter (Public read-only endpoints)
export const getLimiter = rateLimit({
  windowMs: env.API_RATE_LIMIT_WINDOW_MS,
  max: env.API_RATE_LIMIT_GET_MAX, // Generous limit for read-only traffic (e.g. 3000 requests/15m)
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: buildRateLimitKey,
  handler: (req, res, _next, options) => {
    logRateLimitHit(req, "getLimiter", options);
    const retryAfterSeconds = Math.max(1, Math.ceil(options.windowMs / 1000));
    res.setHeader("Retry-After", String(retryAfterSeconds));
    res.status(options.statusCode).json({
      success: false,
      message: "Too many requests. Please wait a moment and retry.",
      data: {
        retryAfterSeconds,
      },
    });
  },
});

// 2. Write Rate Limiter (Mutations, Payments, Bookings)
export const writeLimiter = rateLimit({
  windowMs: env.API_RATE_LIMIT_WINDOW_MS,
  max: env.API_RATE_LIMIT_MAX, // Standard limit (e.g. 200 requests/15m)
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: buildRateLimitKey,
  handler: (req, res, _next, options) => {
    logRateLimitHit(req, "writeLimiter", options);
    const retryAfterSeconds = Math.max(1, Math.ceil(options.windowMs / 1000));
    res.setHeader("Retry-After", String(retryAfterSeconds));
    res.status(options.statusCode).json({
      success: false,
      message: "Too many write requests. Please wait a moment and retry.",
      data: {
        retryAfterSeconds,
      },
    });
  },
});

// 3. Auth Rate Limiter (Signups, Logins, Forgot Password)
export const authRateLimiter = rateLimit({
  windowMs: 5 * 60 * 1000, // 5 minutes
  max: 20, // Max 20 attempts
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: buildAuthRateLimitKey,
  handler: (req, res, _next, options) => {
    let authKey = "unknown";
    try {
      authKey = buildAuthRateLimitKey(req);
    } catch {
      // Ignored: key fallback to default
    }
    logRateLimitHit(req, "authRateLimiter", { ...options, authKey });
    const retryAfterSeconds = Math.max(1, Math.ceil(options.windowMs / 1000));
    res.setHeader("Retry-After", String(retryAfterSeconds));
    res.status(options.statusCode).json({
      success: false,
      message: "Too many authentication attempts. Please try again after 5 minutes.",
      data: {
        retryAfterSeconds,
      },
    });
  },
});

// 4. Webhook Rate Limiter (Razorpay etc.)
export const webhookRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 1000, // Very generous threshold to prevent dropping webhooks
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => ipKeyGenerator(req.ip || "127.0.0.1"),
  handler: (req, res, _next, options) => {
    logRateLimitHit(req, "webhookRateLimiter", options);
    res.status(options.statusCode).json({
      success: false,
      message: "Too many webhook requests.",
      data: {},
    });
  },
});

// 5. Review Submission Rate Limiter
export const reviewRateLimiter = rateLimit({
  windowMs: 10 * 60 * 1000, // 10 minutes
  max: 6, // Max 6 reviews per 10m
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: buildRateLimitKey,
  handler: (req, res, _next, options) => {
    logRateLimitHit(req, "reviewRateLimiter", options);
    const retryAfterSeconds = Math.max(1, Math.ceil(options.windowMs / 1000));
    res.setHeader("Retry-After", String(retryAfterSeconds));
    res.status(options.statusCode).json({
      success: false,
      message: "Too many review submissions. Please try again after 10 minutes.",
      data: {
        retryAfterSeconds,
      },
    });
  },
});

// Coordinator Dispatcher
export function rateLimiterDispatcher(req: Request, res: Response, next: NextFunction) {
  // 1. Skip rate limiting for internal Next.js requests (server-side fetches)
  const userAgent = String(req.headers["user-agent"] ?? "");
  const internalHeader = String(req.headers["x-bme-internal-secret"] ?? "");
  if (userAgent.includes("BME-Internal-Secret-9f8d2a1b") || internalHeader === "9f8d2a1b") {
    return next();
  }

  // 2. Skip rate limiting for health check, session, and refresh-token
  const path = req.path || "";
  if (
    path === "/api/v1/health" ||
    path === "/health" ||
    path === "/api/v1/auth/session" ||
    path === "/auth/session" ||
    path === "/api/v1/auth/refresh-token" ||
    path === "/auth/refresh-token" ||
    path === "/api/v1/reviews/summary" ||
    path === "/reviews/summary"
  ) {
    return next();
  }

  // 3. Webhook Limiter
  if (path.startsWith("/api/v1/webhooks") || path.startsWith("/webhooks")) {
    return webhookRateLimiter(req, res, next);
  }

  // 4. Review Submission Limiter (POST /api/v1/reviews)
  if (path === "/api/v1/reviews" && req.method === "POST") {
    return reviewRateLimiter(req, res, next);
  }

  // 5. Auth Limiter (signup, login, otp, forgot-password)
  // Skip globally; these are handled at route level inside auth.route.ts where body parsing has run
  if (path.startsWith("/api/v1/auth") || path.startsWith("/auth")) {
    if (
      path.includes("/login") ||
      path.includes("/signup") ||
      path.includes("/send-otp") ||
      path.includes("/request-otp") ||
      path.includes("/verify-otp") ||
      path.includes("/forgot-password")
    ) {
      return next();
    }
  }

  // 6. GET Limiter (excluding payments and bookings)
  if (req.method === "GET") {
    const isPaymentOrBooking = path.includes("/payments") || path.includes("/bookings");
    if (!isPaymentOrBooking) {
      return getLimiter(req, res, next);
    }
  }

  // 7. Write Limiter (Mutations, Payments, Bookings)
  return writeLimiter(req, res, next);
}
