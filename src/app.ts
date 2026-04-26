import cors from "cors";
import express from "express";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import pinoHttp from "pino-http";
import { env } from "./config/env";
import { logger } from "./config/logger";
import { errorMiddleware, notFoundMiddleware } from "./middlewares/error.middleware";
import { enforceJsonRequests, sanitizeRequestMiddleware } from "./middlewares/sanitize.middleware";
import { apiV1Router } from "./routes";

export const app = express();

app.set("trust proxy", env.TRUST_PROXY);

const defaultLocalOrigins = ["http://localhost:3000", "http://127.0.0.1:3000", "https://bookmyevent.ae", "https://www.bookmyevent.ae"];
const allowedOrigins = env.ALLOWED_ORIGINS.length ? env.ALLOWED_ORIGINS : defaultLocalOrigins;

app.use(
  pinoHttp({
    logger,
  }),
);

app.use(helmet());
app.use(
  cors({
    origin: (origin, callback) => {
      // Allow server-to-server requests with no Origin header.
      if (!origin) {
        callback(null, true);
        return;
      }

      if (allowedOrigins.includes(origin)) {
        callback(null, true);
        return;
      }

      callback(new Error("CORS origin is not allowed"));
    },
    credentials: true,
  }),
);

app.use(
  rateLimit({
    windowMs: env.API_RATE_LIMIT_WINDOW_MS,
    max: env.API_RATE_LIMIT_MAX,
    standardHeaders: true,
    legacyHeaders: false,
  }),
);

app.use(express.json({ limit: "2mb" }));
app.use(express.urlencoded({ extended: true }));
app.use(enforceJsonRequests);
app.use(sanitizeRequestMiddleware);

app.use("/api/v1", apiV1Router);

app.use(notFoundMiddleware);
app.use(errorMiddleware);
