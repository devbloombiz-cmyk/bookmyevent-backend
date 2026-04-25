import type { NextFunction, Request, Response } from "express";

const WINDOW_MS = 10 * 60 * 1000;
const MAX_REQUESTS = 50;
const requestBuckets = new Map<string, number[]>();

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

export function otpSendRateLimit(req: Request, res: Response, next: NextFunction) {
  const requestKey = buildRequestKey(req);
  const now = Date.now();
  const windowStart = now - WINDOW_MS;

  const recentRequests = (requestBuckets.get(requestKey) ?? []).filter((timestamp) => timestamp >= windowStart);
  if (recentRequests.length >= MAX_REQUESTS) {
    return res.status(429).json({
      success: false,
      message: "Too many OTP requests. Please try again later",
      data: {},
    });
  }

  recentRequests.push(now);
  requestBuckets.set(requestKey, recentRequests);

  return next();
}
