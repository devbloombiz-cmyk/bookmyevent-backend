import type { NextFunction, Request, Response } from "express";
import type { PermissionKey } from "../config/permissions";
import { auditLogService } from "../services/audit-log.service";
import { ApiError } from "../utils/api-error";

export function authorize(permission: PermissionKey | PermissionKey[]) {
  return (req: Request, _res: Response, next: NextFunction) => {
    const authUser = req.authUser;
    const requiredPermissions = Array.isArray(permission) ? permission : [permission];

    if (!authUser) {
      auditLogService.write({
        action: "authorize",
        outcome: "failure",
        resource: requiredPermissions.join("|"),
      });
      return next(new ApiError(401, "Authentication required"));
    }

    const hasAccess = requiredPermissions.some((entry) => authUser.permissions.includes(entry));
    if (!hasAccess) {
      auditLogService.write({
        actorUserId: authUser.id,
        action: "authorize",
        resource: requiredPermissions.join("|"),
        outcome: "denied",
      });
      return next(new ApiError(403, "Forbidden"));
    }

    return next();
  };
}
