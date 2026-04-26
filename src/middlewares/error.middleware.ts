import type { NextFunction, Request, Response } from "express";
import multer from "multer";
import { ApiError } from "../utils/api-error";
import { logger } from "../config/logger";

export function notFoundMiddleware(req: Request, _res: Response, next: NextFunction) {
  next(new ApiError(404, `Route not found: ${req.originalUrl}`));
}

export function errorMiddleware(error: unknown, _req: Request, res: Response, _next: NextFunction) {
  void _next;

  if (error instanceof multer.MulterError) {
    const isFileSizeError = error.code === "LIMIT_FILE_SIZE";

    return res.status(400).json({
      success: false,
      message: isFileSizeError ? "File size must be 2MB or smaller" : "Invalid upload request",
      data: {},
    });
  }

  const statusCode =
    error instanceof ApiError
      ? error.statusCode
      : typeof error === "object" && error !== null && "statusCode" in error
        ? Number((error as { statusCode: number }).statusCode)
        : 500;

  const fullMessage =
    error instanceof Error
      ? error.message
      : typeof error === "object" && error !== null && "message" in error
        ? String((error as { message: string }).message)
        : "Internal Server Error";

  const shouldExposeServerError = process.env.NODE_ENV === "development";
  const safeMessage =
    statusCode >= 500 && !shouldExposeServerError ? "Something went wrong" : fullMessage;

  logger.error({ error }, "Request failed");
  res.status(statusCode).json({
    success: false,
    message: safeMessage,
    data: {},
  });
}
