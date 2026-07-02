import { Request, Response } from "express";
import mongoose from "mongoose";
import { getActiveRequestsCount, getAverageResponseTime, getTotalRequestsCount } from "../utils/metrics";

let eventLoopDelay = 0;
let lastTime = Date.now();
setInterval(() => {
  const now = Date.now();
  eventLoopDelay = Math.max(0, now - lastTime - 1000);
  lastTime = now;
}, 1000).unref();

export const healthController = {
  getHealth: (_req: Request, res: Response) => {
    const memory = process.memoryUsage();
    const mongoStatusMap: Record<number, string> = {
      0: "disconnected",
      1: "connected",
      2: "connecting",
      3: "disconnecting",
    };

    res.status(200).json({
      success: true,
      message: "BookMyEvent API is healthy",
      data: {
        status: "healthy",
        uptimeSeconds: parseFloat(process.uptime().toFixed(2)),
        version: "1.0.0",
        timestamp: new Date().toISOString(),
        mongoStatus: mongoStatusMap[mongoose.connection.readyState] || "unknown",
        eventLoopDelayMs: eventLoopDelay,
        memory: {
          rssBytes: memory.rss,
          heapTotalBytes: memory.heapTotal,
          heapUsedBytes: memory.heapUsed,
          externalBytes: memory.external,
        },
        cpuUsage: process.cpuUsage(),
      },
    });
  },

  getDiagnostics: (_req: Request, res: Response) => {
    const memory = process.memoryUsage();
    res.status(200).json({
      success: true,
      message: "Diagnostics data retrieved successfully",
      data: {
        activeConnections: getActiveRequestsCount(),
        pendingRequests: getActiveRequestsCount(),
        totalRequests: getTotalRequestsCount(),
        averageResponseTimeMs: getAverageResponseTime(),
        mongo: {
          readyState: mongoose.connection.readyState,
          host: mongoose.connection.host,
          port: mongoose.connection.port,
          name: mongoose.connection.name,
        },
        memoryUsage: {
          rssBytes: memory.rss,
          heapTotalBytes: memory.heapTotal,
          heapUsedBytes: memory.heapUsed,
        },
        timestamp: new Date().toISOString(),
      },
    });
  },
};
