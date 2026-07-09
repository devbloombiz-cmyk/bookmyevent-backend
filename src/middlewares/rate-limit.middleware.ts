import { createHash, randomUUID } from "node:crypto";
import rateLimit, { ipKeyGenerator } from "express-rate-limit";
import type { Request, Response, NextFunction } from "express";
import { env } from "../config/env";
import { logger } from "../config/logger";
import { parseCookieHeader } from "../utils/cookie";

function hashIdentity(value: string): string {
  return createHash("sha256").update(value).digest("hex").slice(0, 20);
}

// 1. Global Guest Session Middleware (ensures all guest clients get a cookie)
export function guestSessionMiddleware(req: Request, res: Response, next: NextFunction) {
  const cookies = parseCookieHeader(req.headers.cookie);
  const guestId = cookies["bme_guest_id"];

  if (!guestId) {
    const newGuestId = randomUUID();

    // Set cookie on response
    res.cookie("bme_guest_id", newGuestId, {
      maxAge: 365 * 24 * 60 * 60 * 1000, // 1 year
      httpOnly: true,
      secure: env.AUTH_COOKIE_SECURE,
      sameSite: "lax",
      path: "/",
      domain: env.AUTH_COOKIE_DOMAIN || undefined,
    });

    req.guestId = newGuestId;
  } else {
    req.guestId = guestId;
  }

  next();
}

// 2. Custom Key Generator
export function buildRateLimitKey(req: Request): string {
  // A. Check if authenticated user is already attached (reused from auth middleware)
  if (req.authUser?.id) {
    return `auth:${req.authUser.id}`;
  }

  // B. Check guest ID cookie (only if it was received in the request to prevent cookie-discard bypasses)
  const cookies = parseCookieHeader(req.headers.cookie);
  const guestId = cookies["bme_guest_id"];
  if (guestId) {
    return `guest:${hashIdentity(guestId)}`;
  }

  // C. Fallback to IP + User-Agent for clients without cookie support
  const clientIp = ipKeyGenerator(req.ip || "127.0.0.1");
  const userAgent = req.headers["user-agent"] || "";
  return `ip_ua:${hashIdentity(`${clientIp}:${userAgent}`)}`;
}

// 3. Secure Server-to-Server Bypass Check
export function isTrustedInternalRequest(req: Request): boolean {
  const secretHeader = req.headers["x-bme-internal-secret"];
  const userAgent = req.headers["user-agent"] || "";

  // Enforce bypass secret
  if (!env.INTERNAL_BYPASS_SECRET || secretHeader !== env.INTERNAL_BYPASS_SECRET) {
    return false;
  }

  // Block browser clients spoofing the header
  const secFetchDest = req.headers["sec-fetch-dest"];
  const secFetchSite = req.headers["sec-fetch-site"];
  if (secFetchDest || secFetchSite) {
    return false;
  }

  // Verify internal user-agent signature
  if (userAgent.includes("BME-Internal-Secret")) {
    return true;
  }

  return false;
}

interface LogOptions {
  windowMs?: number;
  limit?: unknown;
  max?: unknown;
}

// 4. Structured Abuse Logging
function logRateLimitHit(req: Request, limiterName: string, options: LogOptions) {
  const cookies = parseCookieHeader(req.headers.cookie);
  const guestId = cookies["bme_guest_id"] || req.guestId || "none";
  const userId = req.authUser?.id || "anonymous";

  logger.warn(
    {
      limiter: limiterName,
      path: req.originalUrl || req.path,
      method: req.method,
      ip: req.ip,
      userAgent: req.headers["user-agent"] || "none",
      userId,
      guestId,
      windowMs: options.windowMs,
      limit: options.limit ?? options.max,
      timestamp: new Date().toISOString(),
    },
    `Rate limit exceeded: ${limiterName}`,
  );
}

// 5. Modular Route-Specific Limiters

// GET public read-only pages (e.g. categories, locations, blogs, gallery)
export const publicReadLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: env.API_RATE_LIMIT_PUBLIC_READ_MAX,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: buildRateLimitKey,
  skip: isTrustedInternalRequest,
  handler: (req, res, _next, options) => {
    logRateLimitHit(req, "publicReadLimiter", options);
    res.status(429).json({
      success: false,
      message: "Too many browsing requests. Please wait a moment and retry.",
    });
  },
});

// GET listing pages / Search / Filters (more resource intensive)
export const searchLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: env.API_RATE_LIMIT_SEARCH_MAX,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: buildRateLimitKey,
  skip: isTrustedInternalRequest,
  handler: (req, res, _next, options) => {
    logRateLimitHit(req, "searchLimiter", options);
    res.status(429).json({
      success: false,
      message: "Too many search requests. Please wait a moment and retry.",
    });
  },
});

// Authentication attempts (login, signup, reset password)
export const authRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: env.API_RATE_LIMIT_AUTH_MAX,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: buildRateLimitKey,
  handler: (req, res, _next, options) => {
    logRateLimitHit(req, "authRateLimiter", options);
    res.status(429).json({
      success: false,
      message: "Too many authentication requests. Please try again later.",
    });
  },
});

// OTP Send/Requests
export const otpSendRateLimit = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    const body = req.body as { email?: string; mobile?: string; identifier?: string } | undefined;
    const identifier = body?.email ?? body?.mobile ?? body?.identifier;
    if (identifier && typeof identifier === "string" && identifier.trim()) {
      return `otp:${hashIdentity(identifier.trim().toLowerCase())}`;
    }
    return buildRateLimitKey(req);
  },
  handler: (req, res, _next, options) => {
    logRateLimitHit(req, "otpSendRateLimit", options);
    res.status(429).json({
      success: false,
      message: "Too many OTP requests. Please wait 10 minutes and try again.",
    });
  },
});

// Booking requests
export const bookingRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: env.API_RATE_LIMIT_WRITE_MAX,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: buildRateLimitKey,
  handler: (req, res, _next, options) => {
    logRateLimitHit(req, "bookingRateLimiter", options);
    res.status(429).json({
      success: false,
      message: "Too many booking requests. Please wait a moment.",
    });
  },
});

// Payment transactions
export const paymentRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: env.API_RATE_LIMIT_WRITE_MAX,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: buildRateLimitKey,
  handler: (req, res, _next, options) => {
    logRateLimitHit(req, "paymentRateLimiter", options);
    res.status(429).json({
      success: false,
      message: "Too many payment transaction attempts. Please try again later.",
    });
  },
});

// Dashboard actions for Admins, Vendors, and Venue Owners
export const adminRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: env.API_RATE_LIMIT_ADMIN_MAX,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: buildRateLimitKey,
  handler: (req, res, _next, options) => {
    logRateLimitHit(req, "adminRateLimiter", options);
    res.status(429).json({
      success: false,
      message: "Too many dashboard requests. Please wait a moment.",
    });
  },
});

// Verified incoming Payment Webhooks
export const webhookRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: env.API_RATE_LIMIT_WEBHOOK_MAX,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => ipKeyGenerator(req.ip || "127.0.0.1"),
  handler: (req, res, _next, options) => {
    logRateLimitHit(req, "webhookRateLimiter", options);
    res.status(429).json({
      success: false,
      message: "Too many webhook requests.",
    });
  },
});

// Public Review Submissions
export const reviewRateLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: 6,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: buildRateLimitKey,
  handler: (req, res, _next, options) => {
    logRateLimitHit(req, "reviewRateLimiter", options);
    res.status(429).json({
      success: false,
      message: "Too many review submissions. Please wait a moment.",
    });
  },
});
