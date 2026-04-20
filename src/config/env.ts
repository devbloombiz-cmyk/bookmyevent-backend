import dotenv from "dotenv";
import { z } from "zod";

dotenv.config();

const envSchema = z.object({
  PORT: z.coerce.number().default(5000),
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  MONGODB_URI: z.string().min(1, "MONGODB_URI is required"),
  JWT_SECRET: z.string().min(32, "JWT_SECRET must be at least 32 chars"),
  JWT_REFRESH_SECRET: z.string().min(32, "JWT_REFRESH_SECRET must be at least 32 chars"),
  JWT_ACCESS_EXPIRES_IN: z.string().optional(),
  JWT_REFRESH_EXPIRES_IN: z.string().optional(),
  AWS_ACCESS_KEY_ID: z.string().optional(),
  AWS_SECRET_ACCESS_KEY: z.string().optional(),
  AWS_REGION: z.string().optional(),
  AWS_BUCKET_NAME: z.string().optional(),
  RAZORPAY_KEY_ID: z.string().optional(),
  RAZORPAY_KEY_SECRET: z.string().optional(),
  REDIS_URL: z.string().optional(),
});

const parsedEnv = envSchema.parse(process.env);

const defaultAccessExpiry = parsedEnv.NODE_ENV === "development" ? "24h" : "15m";
const defaultRefreshExpiry = parsedEnv.NODE_ENV === "development" ? "90d" : "7d";

export const env = {
  ...parsedEnv,
  JWT_ACCESS_EXPIRES_IN: parsedEnv.JWT_ACCESS_EXPIRES_IN ?? defaultAccessExpiry,
  JWT_REFRESH_EXPIRES_IN: parsedEnv.JWT_REFRESH_EXPIRES_IN ?? defaultRefreshExpiry,
};
