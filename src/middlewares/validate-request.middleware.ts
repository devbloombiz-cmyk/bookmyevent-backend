import type { NextFunction, Request, Response } from "express";
import { ZodType } from "zod";

type ParsedRequest = {
  body: unknown;
  query: unknown;
  params: unknown;
};

export function validateRequest(schema: ZodType) {
  return (req: Request, _res: Response, next: NextFunction) => {
    const result = schema.safeParse({
      body: req.body,
      query: req.query,
      params: req.params,
    });

    if (!result.success) {
      return next({
        statusCode: 400,
        message: result.error.issues[0]?.message ?? "Validation error",
      });
    }

    const parsed = result.data as ParsedRequest;
    req.body = parsed.body;
    // Avoid mutating req.query / req.params because Express 5 may expose getter-backed objects.

    return next();
  };
}
