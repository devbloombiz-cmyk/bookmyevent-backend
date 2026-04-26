import dotenv from "dotenv";
import { z } from "zod";

dotenv.config();

const envSchema = z
  .object({
    PORT: z.coerce.number().default(5000),
    NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
    MONGO_URI: z.string().optional(),
    MONGODB_URI: z.string().optional(),
    JWT_SECRET: z.string().min(32, "JWT_SECRET must be at least 32 chars"),
    JWT_REFRESH_SECRET: z.string().min(32, "JWT_REFRESH_SECRET must be at least 32 chars"),
    JWT_ACCESS_EXPIRES_IN: z.string().optional(),
    JWT_REFRESH_EXPIRES_IN: z.string().optional(),
    BREVO_API_KEY: z.string().optional(),
    SENDER_EMAIL: z.email().optional(),
    SENDER_NAME: z.string().min(1).optional(),
    SMTP_HOST: z.string().optional(),
    SMTP_PORT: z.coerce.number().int().min(1).max(65535).optional(),
    SMTP_USER: z.string().optional(),
    SMTP_PASS: z.string().optional(),
    FROM_EMAIL: z.email().optional(),
    OTP_EXPIRY_MINUTES: z.coerce.number().int().min(1).max(60).default(10),
    OTP_REQUEST_COOLDOWN_SECONDS: z.coerce.number().int().min(30).max(600).default(60),
    OTP_DEV_FALLBACK_ENABLED: z
      .string()
      .optional()
      .transform((value) => value === "true"),
    AWS_ACCESS_KEY_ID: z.string().optional(),
    AWS_SECRET_ACCESS_KEY: z.string().optional(),
    AWS_REGION: z.string().optional(),
    AWS_BUCKET_NAME: z.string().optional(),
    RAZORPAY_KEY_ID: z.string().optional(),
    RAZORPAY_KEY_SECRET: z.string().optional(),
    REDIS_URL: z.string().optional(),
    ALLOWED_ORIGINS: z.string().optional(),
    TRUST_PROXY: z.coerce.number().int().min(0).max(10).default(1),
    API_RATE_LIMIT_WINDOW_MS: z.coerce.number().int().min(60_000).default(15 * 60 * 1000),
    API_RATE_LIMIT_MAX: z.coerce.number().int().min(20).default(200),
    AUTH_COOKIE_DOMAIN: z.string().optional(),
    AUTH_COOKIE_SECURE: z
      .string()
      .optional()
      .transform((value) => value !== "false"),
    AUTH_ACCESS_COOKIE_NAME: z.string().optional(),
    AUTH_REFRESH_COOKIE_NAME: z.string().optional(),
    AUTH_CSRF_COOKIE_NAME: z.string().optional(),
  })
  .transform((rawEnv) => ({
    ...rawEnv,
    MONGODB_URI: rawEnv.MONGO_URI ?? rawEnv.MONGODB_URI,
    ALLOWED_ORIGINS: (rawEnv.ALLOWED_ORIGINS ?? "")
      .split(",")
      .map((origin) => origin.trim())
      .filter(Boolean),
  }));

const parsedEnv = envSchema.parse(process.env);

if (!parsedEnv.MONGODB_URI) {
  throw new Error("Either MONGO_URI or MONGODB_URI must be provided");
}

const mongodbUri = parsedEnv.MONGODB_URI;

const defaultAccessExpiry = parsedEnv.NODE_ENV === "development" ? "24h" : "15m";
const defaultRefreshExpiry = parsedEnv.NODE_ENV === "development" ? "90d" : "7d";

export const env = {
  ...parsedEnv,
  MONGODB_URI: mongodbUri,
  JWT_ACCESS_EXPIRES_IN: parsedEnv.JWT_ACCESS_EXPIRES_IN ?? defaultAccessExpiry,
  JWT_REFRESH_EXPIRES_IN: parsedEnv.JWT_REFRESH_EXPIRES_IN ?? defaultRefreshExpiry,
  SENDER_NAME: parsedEnv.SENDER_NAME ?? "BookMyEvent",
  SMTP_PORT: parsedEnv.SMTP_PORT ?? 587,
  FROM_EMAIL: parsedEnv.FROM_EMAIL ?? parsedEnv.SENDER_EMAIL,
  OTP_DEV_FALLBACK_ENABLED:
    parsedEnv.NODE_ENV !== "production" && Boolean(parsedEnv.OTP_DEV_FALLBACK_ENABLED),
  AUTH_COOKIE_SECURE:
    parsedEnv.AUTH_COOKIE_SECURE !== undefined
      ? Boolean(parsedEnv.AUTH_COOKIE_SECURE)
      : parsedEnv.NODE_ENV === "production",
  AUTH_ACCESS_COOKIE_NAME: parsedEnv.AUTH_ACCESS_COOKIE_NAME ?? "bme_access",
  AUTH_REFRESH_COOKIE_NAME: parsedEnv.AUTH_REFRESH_COOKIE_NAME ?? "bme_refresh",
  AUTH_CSRF_COOKIE_NAME: parsedEnv.AUTH_CSRF_COOKIE_NAME ?? "bme_csrf",
};
