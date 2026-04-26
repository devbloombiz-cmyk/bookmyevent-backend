import type { PermissionKey } from "../config/permissions";
import type { UserRole } from "./domain";

declare module "express-serve-static-core" {
  interface Request {
    authUser?: {
      id: string;
      name?: string;
      email?: string;
      mobile?: string;
      role: UserRole;
      roleKeys: string[];
      permissions: PermissionKey[];
      defaultLandingPath: string;
    };
  }
}

export {};
