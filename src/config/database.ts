import mongoose from "mongoose";
import { env } from "./env";
import { logger } from "./logger";

export async function connectToDatabase() {
  try {
    await mongoose.connect(env.MONGODB_URI, {
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
      maxPoolSize: 20,
      minPoolSize: 5,
    });
    logger.info("MongoDB connected");
  } catch (error) {
    logger.error({ error }, "MongoDB connection failed");
    throw error;
  }

  mongoose.connection.on("disconnected", () => {
    logger.warn("MongoDB disconnected. Attempting recovery...");
  });

  mongoose.connection.on("reconnected", () => {
    logger.info("MongoDB reconnected");
  });

  mongoose.connection.on("error", (error) => {
    logger.error({ error }, "MongoDB runtime error");
  });
}
