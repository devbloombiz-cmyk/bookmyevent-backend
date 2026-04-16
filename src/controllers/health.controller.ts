import { Request, Response } from "express";

export const healthController = {
  getHealth: (_req: Request, res: Response) => {
    res.status(200).json({
      success: true,
      message: "BookMyEvent API is healthy",
      data: {
        timestamp: new Date().toISOString(),
      },
    });
  },
};
