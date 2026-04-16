import type { NextFunction, Request, Response } from "express";
import { ApiError } from "../utils/api-error";

function sanitizeInPlace(value: unknown): unknown {
  if (Array.isArray(value)) {
    for (let index = 0; index < value.length; index += 1) {
      value[index] = sanitizeInPlace(value[index]);
    }
    return value;
  }

  if (value && typeof value === "object") {
    const objectValue = value as Record<string, unknown>;
    for (const key of Object.keys(objectValue)) {
      if (key.startsWith("$") || key.includes(".")) {
        delete objectValue[key];
        continue;
      }

      objectValue[key] = sanitizeInPlace(objectValue[key]);
    }
    return objectValue;
  }

  if (typeof value === "string") {
    return value.trim();
  }

  return value;
}

export function sanitizeRequestMiddleware(req: Request, _res: Response, next: NextFunction) {
  sanitizeInPlace(req.body);
  sanitizeInPlace(req.query);
  sanitizeInPlace(req.params);
  next();
}

export function enforceJsonRequests(req: Request, _res: Response, next: NextFunction) {
  const isWriteMethod = ["POST", "PUT", "PATCH"].includes(req.method);
  const isJson = req.is("application/json");
  const isMultipart = req.is("multipart/form-data");

  if (isWriteMethod && !isJson && !isMultipart) {
    return next(new ApiError(415, "Content-Type must be application/json"));
  }
  return next();
}
