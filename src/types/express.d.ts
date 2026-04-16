import type { UserRole } from "./domain";

declare module "express-serve-static-core" {
  interface Request {
    authUser?: {
      id: string;
      email: string;
      role: UserRole;
    };
  }
}

export {};
