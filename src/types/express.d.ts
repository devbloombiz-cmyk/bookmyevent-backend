import type { AuthenticatedUser } from "./auth-user";

declare module "express-serve-static-core" {
  interface Request {
    authUser?: AuthenticatedUser;
  }
}

export {};
