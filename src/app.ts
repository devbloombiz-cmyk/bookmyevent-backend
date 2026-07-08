/* eslint-disable @typescript-eslint/no-explicit-any */
import cors from "cors";
import express from "express";
import helmet from "helmet";
import { env } from "./config/env";
import { errorMiddleware, notFoundMiddleware } from "./middlewares/error.middleware";
import { enforceJsonRequests, sanitizeRequestMiddleware } from "./middlewares/sanitize.middleware";
import { traceMiddleware } from "./middlewares/trace.middleware";
import { rateLimiterDispatcher } from "./middlewares/rate-limit.middleware";
import { apiV1Router } from "./routes";
import { webhookRouter } from "./routes/webhook.route";
import { vendorLeadActionRouter } from "./routes/vendor-lead-action.route";

export const app = express();

app.set("trust proxy", ["loopback", "linklocal", "uniquelocal"]);

const defaultLocalOrigins = [
  "https://bookmyevent.ae",
  "https://www.bookmyevent.ae",
  "http://localhost:3000",
  "http://127.0.0.1:3000",
];
const allowedOrigins = env.ALLOWED_ORIGINS.length ? env.ALLOWED_ORIGINS : defaultLocalOrigins;

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

app.use(rateLimiterDispatcher as any);

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
