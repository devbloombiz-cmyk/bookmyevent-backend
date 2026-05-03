import type { NextFunction, Request, Response } from "express";
import multer from "multer";
import { ApiError } from "../utils/api-error";
import { logger } from "../config/logger";

function serializeUnknownError(error: unknown) {
  if (!(error instanceof Error)) {
    if (typeof error === "object" && error !== null) {
      return { ...error };
    }

    return { message: String(error) };
  }

  const candidate = error as Error & {
    code?: string;
    status?: number;
    statusCode?: number;
    response?: unknown;
    body?: unknown;
    cause?: unknown;
  };

  return {
    name: candidate.name,
    message: candidate.message,
    code: candidate.code,
    status: candidate.status ?? candidate.statusCode,
    body: candidate.body,
    response: candidate.response,
    cause: candidate.cause,
    stack: candidate.stack,
  };
}

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

  const duplicateKeyError =
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    Number((error as { code?: number }).code) === 11000;

  if (duplicateKeyError) {
    const keyValue =
      typeof error === "object" && error !== null && "keyValue" in error
        ? ((error as { keyValue?: Record<string, unknown> }).keyValue ?? {})
        : {};

    const duplicateFields = Object.keys(keyValue);
    const message = duplicateFields.includes("userId")
      ? "This account is already linked to another profile. Please login with the existing account or use a different email/mobile."
      : duplicateFields.length
        ? `${duplicateFields.join(", ")} already exists. Please use a different value.`
        : "Duplicate value already exists. Please use a different value.";

    logger.warn(
      {
        error: serializeUnknownError(error),
        path: _req.originalUrl,
        method: _req.method,
        requestId: _req.id,
      },
      "Duplicate key request rejected",
    );

    return res.status(409).json({
      success: false,
      message,
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

  logger.error(
    {
      error: serializeUnknownError(error),
      statusCode,
      path: _req.originalUrl,
      method: _req.method,
      requestId: _req.id,
    },
    "Request failed",
  );
  res.status(statusCode).json({
    success: false,
    message: safeMessage,
    data: {},
  });
}
