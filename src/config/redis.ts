import Redis from "ioredis";
import { env } from "./env";
import { logger } from "./logger";

let redisClient: Redis | null = null;

export function getRedisClient() {
  if (!env.REDIS_URL) {
    logger.warn("REDIS_URL not set; Redis client not initialized.");
    return null;
  }

  if (!redisClient) {
    redisClient = new Redis(env.REDIS_URL, { maxRetriesPerRequest: 2 });
    redisClient.on("connect", () => logger.info("Redis connected"));
    redisClient.on("error", (error) => logger.error({ error }, "Redis error"));
  }

  return redisClient;
}
