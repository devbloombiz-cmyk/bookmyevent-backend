import dotenv from "dotenv";
import { connectToDatabase } from "./config/database";
import { env } from "./config/env";
import { logger } from "./config/logger";
import { app } from "./app";
import { bootstrapSuperAdmin } from "./services/admin-seed.service";
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

  try {
    const adminSeedResult = await bootstrapSuperAdmin({
      allowDefaults: false,
      ensurePbacCatalog: false,
    });

    if (adminSeedResult.status === "skipped") {
      if (adminSeedResult.reason === "disabled") {
        logger.info("Super admin bootstrap skipped (SEED_ADMIN_ENABLED=false)");
      } else {
        logger.warn(
          "Super admin bootstrap skipped: set SEED_ADMIN_EMAIL, SEED_ADMIN_PASSWORD, SEED_ADMIN_NAME and SEED_ADMIN_MOBILE",
        );
      }
    } else {
      logger.info(
        {
          userId: adminSeedResult.userId,
          email: adminSeedResult.email,
          mobile: adminSeedResult.mobile,
          mode: adminSeedResult.status,
        },
        "Super admin bootstrap completed",
      );
    }
  } catch (error) {
    logger.error({ error }, "Super admin bootstrap failed");
  }

  app.listen(env.PORT, () => {
    logger.info(`BookMyEvent API running on port ${env.PORT}`);
  });
}

bootstrap().catch((error) => {
  logger.error({ error }, "Failed to bootstrap server");
  process.exit(1);
});
