import dotenv from "dotenv";
import { connectToDatabase } from "../config/database";
import { pbacRepository } from "../repositories/pbac.repository";
import { userRepository } from "../repositories/user.repository";
import { bootstrapDefaultPbacCatalog } from "../services/pbac.service";
import { hashPassword } from "../utils/password";

dotenv.config();

async function seedAdmin() {
  const adminEmail = process.env.SEED_ADMIN_EMAIL ?? "ajsal12aju@gmail.com";
  const adminPassword = process.env.SEED_ADMIN_PASSWORD ?? "Admin@12345";
  const adminName = process.env.SEED_ADMIN_NAME ?? "Platform Super Admin";
  const adminMobile = process.env.SEED_ADMIN_MOBILE ?? "9999999999";

  await connectToDatabase();
  await bootstrapDefaultPbacCatalog();

  const passwordHash = await hashPassword(adminPassword);

  const existingByEmail = await userRepository.findByEmail(adminEmail);
  const existingByMobile = await userRepository.findByMobile(adminMobile);

  if (existingByEmail && existingByMobile && String(existingByEmail._id) !== String(existingByMobile._id)) {
    throw new Error(
      `Cannot seed admin safely. Email ${adminEmail} and mobile ${adminMobile} belong to different users.`,
    );
  }

  const targetUser = existingByEmail ?? existingByMobile;

  const adminUser = targetUser
    ? await userRepository.updateById(String(targetUser._id), {
        name: adminName,
        email: adminEmail.toLowerCase(),
        mobile: adminMobile,
        passwordHash,
        role: "super_admin" as const,
        isActive: true,
      })
    : await userRepository.upsertByEmail(adminEmail, {
        name: adminName,
        email: adminEmail.toLowerCase(),
        mobile: adminMobile,
        passwordHash,
        role: "super_admin" as const,
        isActive: true,
      });

  if (!adminUser) {
    throw new Error("Failed to create or update super admin user");
  }

  const superAdminRole = await pbacRepository.findRoleByKey("super_admin");
  if (!superAdminRole) {
    throw new Error("super_admin role not found after PBAC bootstrap");
  }

  await pbacRepository.bindUserRole(String(adminUser._id), String(superAdminRole._id));

  console.warn(
    `Super admin ready (userId=${String(adminUser._id)}). Login with email (${adminEmail}) or mobile (${adminMobile}).`,
  );
  process.exit(0);
}

seedAdmin().catch((error) => {
  console.error("Failed to seed admin user", error);
  process.exit(1);
});
