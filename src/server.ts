import dotenv from "dotenv";
import { connectToDatabase } from "./config/database";
import { env } from "./config/env";
import { logger } from "./config/logger";
import { app } from "./app";
import { bootstrapDefaultPbacCatalog } from "./services/pbac.service";

dotenv.config();

process.on("unhandledRejection", (reason) => {
  logger.error({ reason }, "Unhandled promise rejection");
  process.exit(1);
});

process.on("uncaughtException", (error) => {
  logger.error({ error }, "Uncaught exception");
  process.exit(1);
});

async function bootstrap() {
  await connectToDatabase();

  try {
    await bootstrapDefaultPbacCatalog();
    logger.info("PBAC catalog bootstrap completed");
  } catch (error) {
    logger.error({ error }, "PBAC catalog bootstrap failed");
  }

  app.listen(env.PORT, () => {
    logger.info(`BookMyEvent API running on port ${env.PORT}`);
  });
}

bootstrap().catch((error) => {
  logger.error({ error }, "Failed to bootstrap server");
  process.exit(1);
});
