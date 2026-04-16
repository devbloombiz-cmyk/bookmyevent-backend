import cors from "cors";
import express from "express";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import pinoHttp from "pino-http";
import { logger } from "./config/logger";
import { ensureUploadDirectories, uploadsConfig } from "./config/uploads";
import { errorMiddleware, notFoundMiddleware } from "./middlewares/error.middleware";
import { enforceJsonRequests, sanitizeRequestMiddleware } from "./middlewares/sanitize.middleware";
import { apiV1Router } from "./routes";

export const app = express();

ensureUploadDirectories();

app.use(
  pinoHttp({
    logger,
  }),
);

app.use(helmet());
app.use(
  cors({
    origin: true,
    credentials: true,
  }),
);

app.use(
  rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 500,
    standardHeaders: true,
    legacyHeaders: false,
  }),
);

app.use(express.json({ limit: "2mb" }));
app.use(express.urlencoded({ extended: true }));
app.use(enforceJsonRequests);
app.use(sanitizeRequestMiddleware);
app.use(
  "/uploads",
  express.static(uploadsConfig.uploadRoot, {
    setHeaders: (res) => {
      res.setHeader("Cross-Origin-Resource-Policy", "cross-origin");
    },
  }),
);

app.use("/api/v1", apiV1Router);

app.use(notFoundMiddleware);
app.use(errorMiddleware);
