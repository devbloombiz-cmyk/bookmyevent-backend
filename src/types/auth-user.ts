import type { PermissionKey } from "../config/permissions";
import type { UserRole } from "./domain";

export type AuthenticatedUser = {
  id: string;
  name?: string;
  email?: string;
  mobile?: string;
  role: UserRole;
  roleKeys: string[];
  permissions: PermissionKey[];
  defaultLandingPath: string;
};
