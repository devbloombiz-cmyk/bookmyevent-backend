import dotenv from "dotenv";
import { connectToDatabase } from "../config/database";
import { userRepository } from "../repositories/user.repository";
import { hashPassword } from "../utils/password";

dotenv.config();

async function seedAdmin() {
  const adminEmail = process.env.SEED_ADMIN_EMAIL ?? "admin@bookmyevent.local";
  const adminPassword = process.env.SEED_ADMIN_PASSWORD ?? "Admin@12345";
  const adminName = process.env.SEED_ADMIN_NAME ?? "Platform Super Admin";
  const adminMobile = process.env.SEED_ADMIN_MOBILE ?? "9999999999";

  await connectToDatabase();

  const existingSuperAdmin = await userRepository.findAnyByRole("super_admin");
  if (existingSuperAdmin) {
    // eslint-disable-next-line no-console
    console.log(`Super admin already exists (${existingSuperAdmin.email}). Skipping seed.`);
    process.exit(0);
  }

  const passwordHash = await hashPassword(adminPassword);

  await userRepository.create({
    name: adminName,
    email: adminEmail.toLowerCase(),
    mobile: adminMobile,
    passwordHash,
    role: "super_admin",
  });

  // eslint-disable-next-line no-console
  console.log(`Admin user seeded: ${adminEmail}`);
  process.exit(0);
}

seedAdmin().catch((error) => {
  // eslint-disable-next-line no-console
  console.error("Failed to seed admin user", error);
  process.exit(1);
});
