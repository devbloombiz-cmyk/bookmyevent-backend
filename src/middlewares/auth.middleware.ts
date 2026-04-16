import type { NextFunction, Request, Response } from "express";
import { userRepository } from "../repositories/user.repository";
import { ApiError } from "../utils/api-error";
import { verifyAccessToken } from "../utils/tokens";

export const requireAuth = async (req: Request, _res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) {
    return next(new ApiError(401, "Missing authorization token"));
  }

  const token = authHeader.split(" ")[1];

  try {
    const decoded = verifyAccessToken(token);
    const user = await userRepository.findById(decoded.sub);

    if (!user || !user.isActive) {
      return next(new ApiError(401, "Unauthorized user"));
    }

    req.authUser = {
      id: user.id,
      email: user.email,
      role: user.role,
    };

    return next();
  } catch {
    return next(new ApiError(401, "Invalid or expired token"));
  }
};
