import type { Response } from "express";

type ApiResponse<T> = {
  success: boolean;
  message: string;
  data: T;
};

export function sendSuccess<T>(res: Response, message: string, data: T, statusCode = 200) {
  const payload: ApiResponse<T> = {
    success: true,
    message,
    data,
  };

  return res.status(statusCode).json(payload);
}
