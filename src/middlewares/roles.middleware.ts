import type { NextFunction, Request, Response } from "express";
import { UserRole } from "../types/domain";
import { ApiError } from "../utils/api-error";

export function requireRoles(allowedRoles: UserRole[]) {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.authUser) {
      return next(new ApiError(401, "Authentication required"));
    }

    if (!allowedRoles.includes(req.authUser.role)) {
      return next(new ApiError(403, "Insufficient permissions"));
    }

    return next();
  };
}
