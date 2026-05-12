import dotenv from "dotenv";
import { connectToDatabase } from "../config/database";
import { bootstrapSuperAdmin } from "../services/admin-seed.service";

dotenv.config();

async function seedAdmin() {
  await connectToDatabase();
  const result = await bootstrapSuperAdmin({
    allowDefaults: true,
    ensurePbacCatalog: true,
  });

  if (result.status === "skipped") {
    console.warn(`Super admin seed skipped (${result.reason})`);
    process.exit(0);
    return;
  }

  console.warn(
    `Super admin ready (userId=${result.userId}). Login with email (${result.email}) or mobile (${result.mobile}).`,
  );
  process.exit(0);
}

seedAdmin().catch((error) => {
  console.error("Failed to seed admin user", error);
  process.exit(1);
});
