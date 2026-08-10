/* eslint-disable @typescript-eslint/no-explicit-any */
import mongoose from "mongoose";
import { VendorModel } from "../models/vendor.model";
import { env } from "./env";
import { mongoLogger } from "./logger";

export async function connectToDatabase() {
  // Set up connection event listeners first so we don't miss initial connect/connecting events
  mongoose.connection.on("connecting", () => {
    mongoLogger.info("MongoDB connecting...");
  });

  mongoose.connection.on("connected", () => {
    mongoLogger.info("MongoDB connected successfully");
  });

  mongoose.connection.on("disconnected", () => {
    mongoLogger.warn("MongoDB disconnected. Attempting recovery...");
  });

  mongoose.connection.on("reconnected", () => {
    mongoLogger.info("MongoDB reconnected");
  });

  mongoose.connection.on("error", (error) => {
    mongoLogger.error({ error }, "MongoDB runtime error");
  });

  mongoose.connection.on("close", () => {
    mongoLogger.info("MongoDB connection closed");
  });

  // Enable global query performance logging
  mongoose.plugin((schema) => {
    // Hook for standard query methods
    schema.pre(/^find|^count|^update|^delete/, function (this: any) {
      this._startTime = process.hrtime();
    });

    schema.post(/^find|^count|^update|^delete/, function (this: any, res: any) {
      void res;
      if (this._startTime) {
        const diff = process.hrtime(this._startTime);
        const durationMs = (diff[0] * 1e9 + diff[1]) / 1e6;
        const modelName = this.model?.modelName || "Unknown";
        const queryInfo = {
          model: modelName,
          filter: this.getQuery ? this.getQuery() : {},
          options: this.getOptions ? this.getOptions() : {},
          update: this.getUpdate ? this.getUpdate() : undefined,
          durationMs: parseFloat(durationMs.toFixed(2)),
        };

        if (durationMs > 500) {
          mongoLogger.warn(queryInfo, `SLOW MONGO QUERY (>500ms): ${durationMs.toFixed(2)}ms`);
        } else {
          mongoLogger.info(queryInfo, `Mongo Query [${modelName}]: ${durationMs.toFixed(2)}ms`);
        }
      }
    });

    // Hook for aggregation pipelines
    schema.pre("aggregate", function (this: any) {
      this._startTime = process.hrtime();
    });

    schema.post("aggregate", function (this: any, res: any) {
      void res;
      if (this._startTime) {
        const diff = process.hrtime(this._startTime);
        const durationMs = (diff[0] * 1e9 + diff[1]) / 1e6;
        let modelName = "Unknown";
        try {
          if (this.model) {
            modelName =
              typeof this.model === "function" ? this.model().modelName : this.model.modelName;
          }
        } catch {
          // Fallback if model() call fails
        }
        const pipelineInfo = {
          model: modelName,
          pipeline: this.pipeline ? this.pipeline() : [],
          durationMs: parseFloat(durationMs.toFixed(2)),
        };

        if (durationMs > 500) {
          mongoLogger.warn(
            pipelineInfo,
            `SLOW MONGO AGGREGATION (>500ms): ${durationMs.toFixed(2)}ms`,
          );
        } else {
          mongoLogger.info(
            pipelineInfo,
            `Mongo Aggregation [${modelName}]: ${durationMs.toFixed(2)}ms`,
          );
        }
      }
    });
  });

  try {
    await mongoose.connect(env.MONGODB_URI, {
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
      connectTimeoutMS: 10000,
      heartbeatFrequencyMS: 10000,
      maxPoolSize: 20,
      minPoolSize: 5,
    });

    // Safely sync VendorModel indexes to apply the partialFilterExpression for userId
    await VendorModel.syncIndexes().catch((err: unknown) => {
      mongoLogger.warn({ err }, "VendorModel syncIndexes warning");
    });
  } catch (error) {
    mongoLogger.error({ error }, "MongoDB connection failed during bootstrap");
    throw error;
  }
}
