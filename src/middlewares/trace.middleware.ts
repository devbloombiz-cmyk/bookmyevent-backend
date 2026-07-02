import type { Request, Response, NextFunction } from "express";
import { randomUUID } from "node:crypto";
import { accessLogger } from "../config/logger";
import { trackRequestStart, trackRequestEnd } from "../utils/metrics";

export function traceMiddleware(req: any, res: any, next: any) {
  // Generate or retrieve request ID
  const requestId = (req.headers["x-request-id"] as string) || randomUUID();
  req.id = requestId;
  res.setHeader("X-Request-Id", requestId);

  trackRequestStart();

  const startHrTime = process.hrtime();
  const startCpuUsage = process.cpuUsage();

  res.on("finish", () => {
    const diffHrTime = process.hrtime(startHrTime);
    const responseTimeMs = (diffHrTime[0] * 1e9 + diffHrTime[1]) / 1e6;

    trackRequestEnd(responseTimeMs);

    const endCpuUsage = process.cpuUsage(startCpuUsage);
    const totalCpuTime = endCpuUsage.user + endCpuUsage.system;

    const memoryUsage = process.memoryUsage();

    const logData = {
      timestamp: new Date().toISOString(),
      requestId,
      method: req.method,
      url: req.originalUrl || req.url,
      query: req.query,
      params: req.params,
      userId: req.authUser?.id || null,
      status: res.statusCode,
      responseTimeMs: parseFloat(responseTimeMs.toFixed(2)),
      cpu: {
        userMicroseconds: endCpuUsage.user,
        systemMicroseconds: endCpuUsage.system,
        totalMicroseconds: totalCpuTime,
      },
      memory: {
        rssBytes: memoryUsage.rss,
        heapTotalBytes: memoryUsage.heapTotal,
        heapUsedBytes: memoryUsage.heapUsed,
        externalBytes: memoryUsage.external,
      },
    };

    if (res.statusCode >= 500) {
      accessLogger.error(logData, `Request failed with server error: ${res.statusCode}`);
    } else if (res.statusCode >= 400) {
      accessLogger.warn(logData, `Request completed with client error: ${res.statusCode}`);
    } else {
      accessLogger.info(logData, "Request completed successfully");
    }
  });

  next();
}
