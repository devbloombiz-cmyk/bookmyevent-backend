import type { NextFunction, Request, Response } from "express";
import { getRedisClient } from "../config/redis";
import { logger } from "../config/logger";

const WINDOW_MS = 10 * 60 * 1000;
const MAX_REQUESTS = 5;
const requestBuckets = new Map<string, number[]>();
const REDIS_KEY_PREFIX = "otp:rate-limit";

function buildRequestKey(req: Request) {
  const body = req.body as { identifier?: string; email?: string; mobile?: string } | undefined;
  const identifier = body?.identifier ?? body?.email ?? body?.mobile;
  if (identifier && typeof identifier === "string" && identifier.trim()) {
    return `otp:${identifier.trim().toLowerCase()}`;
  }

  if (typeof req.ip === "string" && req.ip.trim()) {
    return `otp-ip:${req.ip}`;
  }

  if (typeof req.socket?.remoteAddress === "string" && req.socket.remoteAddress.trim()) {
    return `otp-remote:${req.socket.remoteAddress}`;
  }

  return "otp-anonymous";
}

function rejectRateLimited(res: Response) {
  return res.status(429).json({
    success: false,
    message: "Too many OTP requests. Please try again later",
    data: {},
  });
}

function applyInMemoryRateLimit(requestKey: string, res: Response) {
  const now = Date.now();
  const windowStart = now - WINDOW_MS;

  const recentRequests = (requestBuckets.get(requestKey) ?? []).filter(
    (timestamp) => timestamp >= windowStart,
  );
  if (recentRequests.length >= MAX_REQUESTS) {
    return rejectRateLimited(res);
  }

  recentRequests.push(now);
  requestBuckets.set(requestKey, recentRequests);
  return null;
}

export async function otpSendRateLimit(req: Request, res: Response, next: NextFunction) {
  const requestKey = buildRequestKey(req);
  const redisClient = getRedisClient();

  if (!redisClient) {
    const rejected = applyInMemoryRateLimit(requestKey, res);
    if (rejected) {
      return rejected;
    }

    return next();
  }

  try {
    const redisKey = `${REDIS_KEY_PREFIX}:${requestKey}`;
    const requestCount = await redisClient.incr(redisKey);
    if (requestCount === 1) {
      await redisClient.pexpire(redisKey, WINDOW_MS);
    }

    if (requestCount > MAX_REQUESTS) {
      return rejectRateLimited(res);
    }

    return next();
  } catch (error) {
    logger.error(
      { error, requestKey },
      "OTP Redis rate limit check failed; falling back to in-memory limiter",
    );
    const rejected = applyInMemoryRateLimit(requestKey, res);
    if (rejected) {
      return rejected;
    }

    return next();
  }
}
