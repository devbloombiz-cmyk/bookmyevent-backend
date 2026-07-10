import { createHash, randomUUID } from "node:crypto";
import rateLimit, { ipKeyGenerator, type Store } from "express-rate-limit";
import type { Request, Response, NextFunction } from "express";
import { env } from "../config/env";
import { logger } from "../config/logger";
import { parseCookieHeader } from "../utils/cookie";
import { getRedisClient } from "../config/redis";

const INTERNAL_BYPASS_SECRET = "EImLgveIFlzQG8gwpZueTc+cnZBIeJKKMtoYQ2DOfzo=";

const API_RATE_LIMIT_PUBLIC_READ_MAX = 2000;
const API_RATE_LIMIT_SEARCH_MAX = 1000;
const API_RATE_LIMIT_AUTH_MAX = 10;
const API_RATE_LIMIT_WRITE_MAX = 100;
const API_RATE_LIMIT_ADMIN_MAX = 1000;
const API_RATE_LIMIT_WEBHOOK_MAX = 3500;

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

const wrappedKeyGenerator = (customKeyGen?: (req: Request) => string) => {
  return (req: Request) => {
    const key = customKeyGen ? customKeyGen(req) : buildRateLimitKey(req);
    (req as Request & { rateLimitKey?: string }).rateLimitKey = key;
    return key;
  };
};

// 3. Secure Server-to-Server Bypass Check
export function isTrustedInternalRequest(req: Request): boolean {
  if (!INTERNAL_BYPASS_SECRET) {
    return false;
  }

  // Block browser clients spoofing the header or User-Agent
  const secFetchDest = req.headers["sec-fetch-dest"];
  const secFetchSite = req.headers["sec-fetch-site"];
  if (secFetchDest || secFetchSite) {
    return false;
  }

  // A. Check headers (allow both hyphenated and legacy underscored version)
  const secretHeader = req.headers["x-bme-bypass-secret"] || req.headers["x-bme-internal-secret"];
  if (secretHeader === INTERNAL_BYPASS_SECRET) {
    return true;
  }

  // B. Verify internal user-agent signature containing the exact secret
  const userAgent = req.headers["user-agent"] || "";
  const signatureToken = `BME-Internal-Secret-${INTERNAL_BYPASS_SECRET}`;
  if (userAgent.includes(signatureToken)) {
    return true;
  }

  return false;
}

interface IncrementResponse {
  totalHits: number;
  resetTime: Date;
}

class MemoryStoreFallback {
  private windowMs: number;
  private hits = new Map<string, { count: number; resetTime: number }>();

  constructor(windowMs: number) {
    this.windowMs = windowMs;
  }

  increment(key: string): IncrementResponse {
    const now = Date.now();
    const record = this.hits.get(key);

    if (!record || record.resetTime <= now) {
      const resetTime = now + this.windowMs;
      this.hits.set(key, { count: 1, resetTime });
      return { totalHits: 1, resetTime: new Date(resetTime) };
    }

    record.count += 1;
    return { totalHits: record.count, resetTime: new Date(record.resetTime) };
  }

  decrement(key: string): void {
    const now = Date.now();
    const record = this.hits.get(key);
    if (record && record.resetTime > now) {
      record.count = Math.max(0, record.count - 1);
    }
  }

  resetKey(key: string): void {
    this.hits.delete(key);
  }
}

class RedisRateLimitStore implements Store {
  windowMs: number;
  prefix: string;
  private fallbackStore: MemoryStoreFallback;

  constructor(windowMs: number, prefix: string) {
    this.windowMs = windowMs;
    this.prefix = prefix;
    this.fallbackStore = new MemoryStoreFallback(windowMs);
  }

  async increment(key: string): Promise<IncrementResponse> {
    const redis = getRedisClient();
    if (!redis) {
      return this.fallbackStore.increment(key);
    }

    const redisKey = `rl:${this.prefix}:${key}`;
    try {
      const multi = redis.multi();
      multi.incr(redisKey);
      multi.ttl(redisKey);
      const results = await multi.exec();

      if (!results) {
        throw new Error("Redis multi execution returned null");
      }

      const totalHits = results[0][1] as number;
      const ttl = results[1][1] as number;

      let resetTime: Date;
      if (ttl < 0) {
        const expirySeconds = Math.ceil(this.windowMs / 1000);
        await redis.expire(redisKey, expirySeconds);
        resetTime = new Date(Date.now() + this.windowMs);
      } else {
        resetTime = new Date(Date.now() + ttl * 1000);
      }

      return {
        totalHits,
        resetTime,
      };
    } catch (err) {
      logger.error({ err, redisKey }, "Redis rate limit increment error, falling back to memory");
      return this.fallbackStore.increment(key);
    }
  }

  async decrement(key: string): Promise<void> {
    const redis = getRedisClient();
    if (!redis) {
      this.fallbackStore.decrement(key);
      return;
    }

    const redisKey = `rl:${this.prefix}:${key}`;
    try {
      await redis.decr(redisKey);
    } catch (err) {
      logger.error({ err, redisKey }, "Redis rate limit decrement error");
      this.fallbackStore.decrement(key);
    }
  }

  async resetKey(key: string): Promise<void> {
    const redis = getRedisClient();
    if (!redis) {
      this.fallbackStore.resetKey(key);
      return;
    }

    const redisKey = `rl:${this.prefix}:${key}`;
    try {
      await redis.del(redisKey);
    } catch (err) {
      logger.error({ err, redisKey }, "Redis rate limit resetKey error");
      this.fallbackStore.resetKey(key);
    }
  }
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

  const customReq = req as Request & {
    rateLimit?: { resetTime?: Date; current?: number; remaining?: number; limit?: number };
    rateLimitKey?: string;
    id?: string;
  };

  const rateLimit = customReq.rateLimit;
  const resetTime = rateLimit?.resetTime;
  const retryAfter = resetTime ? Math.ceil((resetTime.getTime() - Date.now()) / 1000) : 0;
  const generatedKey = customReq.rateLimitKey || "none";

  logger.warn(
    {
      limiter: limiterName,
      path: req.originalUrl || req.path,
      method: req.method,
      requestId: customReq.id || "none",
      generatedKey,
      userId,
      guestId,
      clientIp: req.ip || "127.0.0.1",
      forwardedIp: req.headers["x-forwarded-for"] || req.headers["x-real-ip"] || "none",
      userAgent: req.headers["user-agent"] || "none",
      requestCount: rateLimit?.current,
      remainingRequests: rateLimit?.remaining,
      configuredLimit: rateLimit?.limit ?? options.limit ?? options.max,
      resetTime: resetTime ? resetTime.toISOString() : "none",
      retryAfter,
      exactReason: `Rate limit exceeded on '${limiterName}'. Current count (${rateLimit?.current}) exceeded the configured limit (${rateLimit?.limit ?? options.limit ?? options.max}) for key '${generatedKey}'.`,
      timestamp: new Date().toISOString(),
    },
    `Rate limit exceeded: ${limiterName}`,
  );
}

// 5. Modular Route-Specific Limiters

// GET public read-only pages (e.g. categories, locations, blogs, gallery)
export const publicReadLimiter = rateLimit({
  windowMs: 5 * 60 * 1000,
  max: API_RATE_LIMIT_PUBLIC_READ_MAX,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: wrappedKeyGenerator(),
  skip: isTrustedInternalRequest,
  store: new RedisRateLimitStore(5 * 60 * 1000, "public_read"),
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
  windowMs: 5 * 60 * 1000,
  max: API_RATE_LIMIT_SEARCH_MAX,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: wrappedKeyGenerator(),
  skip: isTrustedInternalRequest,
  store: new RedisRateLimitStore(5 * 60 * 1000, "search"),
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
  windowMs: 5 * 60 * 1000,
  max: API_RATE_LIMIT_AUTH_MAX,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: wrappedKeyGenerator(),
  store: new RedisRateLimitStore(5 * 60 * 1000, "auth"),
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
  windowMs: 5 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: wrappedKeyGenerator((req) => {
    const body = req.body as { email?: string; mobile?: string; identifier?: string } | undefined;
    const identifier = body?.email ?? body?.mobile ?? body?.identifier;
    if (identifier && typeof identifier === "string" && identifier.trim()) {
      return `otp:${hashIdentity(identifier.trim().toLowerCase())}`;
    }
    return buildRateLimitKey(req);
  }),
  store: new RedisRateLimitStore(5 * 60 * 1000, "otp_send"),
  handler: (req, res, _next, options) => {
    logRateLimitHit(req, "otpSendRateLimit", options);
    res.status(429).json({
      success: false,
      message: "Too many OTP requests. Please wait 5 minutes and try again.",
    });
  },
});

// Booking requests
export const bookingRateLimiter = rateLimit({
  windowMs: 5 * 60 * 1000,
  max: API_RATE_LIMIT_WRITE_MAX,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: wrappedKeyGenerator(),
  store: new RedisRateLimitStore(5 * 60 * 1000, "booking"),
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
  windowMs: 5 * 60 * 1000,
  max: API_RATE_LIMIT_WRITE_MAX,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: wrappedKeyGenerator(),
  store: new RedisRateLimitStore(5 * 60 * 1000, "payment"),
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
  windowMs: 5 * 60 * 1000,
  max: API_RATE_LIMIT_ADMIN_MAX,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: wrappedKeyGenerator(),
  store: new RedisRateLimitStore(5 * 60 * 1000, "admin"),
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
  windowMs: 5 * 60 * 1000,
  max: API_RATE_LIMIT_WEBHOOK_MAX,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: wrappedKeyGenerator((req) => ipKeyGenerator(req.ip || "127.0.0.1")),
  store: new RedisRateLimitStore(5 * 60 * 1000, "webhook"),
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
  windowMs: 5 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: wrappedKeyGenerator(),
  store: new RedisRateLimitStore(5 * 60 * 1000, "review"),
  handler: (req, res, _next, options) => {
    logRateLimitHit(req, "reviewRateLimiter", options);
    res.status(429).json({
      success: false,
      message: "Too many review submissions. Please wait a moment.",
    });
  },
});
