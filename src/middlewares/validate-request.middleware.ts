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
      const firstIssue = result.error.issues[0];
      const pathLabel = firstIssue?.path?.length ? firstIssue.path.join(".") : "request";
      return next({
        statusCode: 400,
        message: firstIssue ? `${pathLabel}: ${firstIssue.message}` : "Validation error",
      });
    }

    const parsed = result.data as ParsedRequest;
    req.body = parsed.body;
    Object.assign(req.query as object, parsed.query as object);
    Object.assign(req.params as object, parsed.params as object);

    return next();
  };
}
