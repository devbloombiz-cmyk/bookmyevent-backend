/* eslint-disable @typescript-eslint/no-explicit-any */
import cors from "cors";
import express from "express";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import { createHash } from "node:crypto";
import { env } from "./config/env";
import { errorMiddleware, notFoundMiddleware } from "./middlewares/error.middleware";
import { enforceJsonRequests, sanitizeRequestMiddleware } from "./middlewares/sanitize.middleware";
import { traceMiddleware } from "./middlewares/trace.middleware";
import { apiV1Router } from "./routes";
import { webhookRouter } from "./routes/webhook.route";
import { vendorLeadActionRouter } from "./routes/vendor-lead-action.route";

export const app = express();

app.set("trust proxy", env.TRUST_PROXY);

const defaultLocalOrigins = [
  "https://bookmyevent.ae",
  "https://www.bookmyevent.ae",
  "http://localhost:3000",
  "http://127.0.0.1:3000",
];
const allowedOrigins = env.ALLOWED_ORIGINS.length ? env.ALLOWED_ORIGINS : defaultLocalOrigins;

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

function buildRateLimitKey(req: express.Request): string {
  const cookieHeader = String(req.headers.cookie ?? "");
  const accessToken = readCookieFromHeader(cookieHeader, env.AUTH_ACCESS_COOKIE_NAME);
  const refreshToken = readCookieFromHeader(cookieHeader, env.AUTH_REFRESH_COOKIE_NAME);

  if (accessToken || refreshToken) {
    return `auth:${hashIdentity(`${accessToken}:${refreshToken}`)}`;
  }

  const userAgent = String(req.headers["user-agent"] ?? "unknown-agent");
  return `ip:${hashIdentity(`${req.ip}:${userAgent}`)}`;
}

app.use(traceMiddleware as any);

app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "'unsafe-inline'"],
        styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
        fontSrc: ["'self'", "https://fonts.gstatic.com"],
        imgSrc: ["'self'", "data:", "https:"],
      },
    },
  }) as any,
);
app.use(
  cors({
    origin: (origin, callback) => {
      // Allow server-to-server requests with no Origin header.
      if (!origin) {
        callback(null, true);
        return;
      }

      if (
        allowedOrigins.includes(origin) ||
        (env.NODE_ENV === "development" &&
          /^https?:\/\/(localhost|127\.0\.0\.1|192\.168\.\d+\.\d+|10\.\d+\.\d+\.\d+|172\.(1[6-9]|2\d|3[0-1])\.\d+\.\d+)(:\d+)?$/.test(
            origin,
          ))
      ) {
        callback(null, true);
        return;
      }

      callback(new Error("CORS origin is not allowed"));
    },
    credentials: true,
  }) as any,
);

app.use(
  rateLimit({
    windowMs: env.API_RATE_LIMIT_WINDOW_MS,
    max: env.API_RATE_LIMIT_MAX,
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: (req) => buildRateLimitKey(req),
    skip: (req) =>
      req.headers["x-bme-internal-secret"] === "bme_ssr_internal_9f8d2a1b" ||
      req.path === "/api/v1/health" ||
      req.path === "/api/v1/auth/session" ||
      req.path === "/api/v1/auth/refresh-token" ||
      (req.method === "GET" && req.path === "/api/v1/reviews/summary"),
    handler: (req, res, _next, options) => {
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
  }) as any,
);

app.use("/api/v1", (_req, res, next) => {
  // Prevent stale admin/public API reads caused by intermediary/browser cache layers.
  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
  res.setHeader("Pragma", "no-cache");
  res.setHeader("Expires", "0");
  next();
});

// Razorpay webhook signature validation requires exact raw request bytes.
app.use(
  "/api/v1/webhooks/razorpay",
  express.raw({ type: "application/json", limit: "2mb" }) as any,
);
app.use("/webhooks/razorpay", express.raw({ type: "application/json", limit: "2mb" }) as any);
app.use("/webhooks", webhookRouter as any);

app.use(express.json({ limit: "2mb" }) as any);
app.use(express.urlencoded({ extended: true }) as any);
app.use(enforceJsonRequests);
app.use(sanitizeRequestMiddleware);

app.use("/api/vendor-lead", vendorLeadActionRouter);
app.use("/vendor-lead", vendorLeadActionRouter);

app.use("/api/v1", apiV1Router);

app.use(notFoundMiddleware);
app.use(errorMiddleware);
