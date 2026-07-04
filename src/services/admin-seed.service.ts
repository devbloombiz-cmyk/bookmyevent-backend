import { pbacRepository } from "../repositories/pbac.repository";
import { userRepository } from "../repositories/user.repository";
import { hashPassword } from "../utils/password";
import { bootstrapDefaultPbacCatalog } from "./pbac.service";

type BootstrapSuperAdminOptions = {
  allowDefaults?: boolean;
  ensurePbacCatalog?: boolean;
};

type BootstrapSuperAdminResult =
  | {
      status: "created" | "updated";
      userId: string;
      email: string;
      mobile: string;
    }
  | {
      status: "skipped";
      reason: "disabled" | "missing-config" | "already-exists";
    };

const defaultSeedConfig = {
  name: "Platform Super Admin",
  mobile: "9999999999",
};

function pickFirstNonEmpty(...values: Array<string | undefined>) {
  for (const value of values) {
    const normalized = value?.trim();
    if (normalized) {
      return normalized;
    }
  }

  return undefined;
}

function resolveSeedConfig(allowDefaults: boolean) {
  const email = pickFirstNonEmpty(process.env.SEED_ADMIN_EMAIL, process.env.ADMIN_EMAIL);
  const password = pickFirstNonEmpty(process.env.SEED_ADMIN_PASSWORD, process.env.ADMIN_PASSWORD);
  const name = pickFirstNonEmpty(process.env.SEED_ADMIN_NAME, process.env.ADMIN_NAME);
  const mobile = pickFirstNonEmpty(process.env.SEED_ADMIN_MOBILE, process.env.ADMIN_MOBILE);

  return {
    email,
    password,
    name: name ?? (allowDefaults ? defaultSeedConfig.name : undefined),
    mobile: mobile ?? (allowDefaults ? defaultSeedConfig.mobile : undefined),
  };
}

export async function bootstrapSuperAdmin(
  options: BootstrapSuperAdminOptions = {},
): Promise<BootstrapSuperAdminResult> {
  const allowDefaults = options.allowDefaults ?? false;
  const ensurePbacCatalog = options.ensurePbacCatalog ?? false;

  const seedEnabled = process.env.SEED_ADMIN_ENABLED?.trim().toLowerCase();
  if (seedEnabled === "false") {
    return {
      status: "skipped",
      reason: "disabled",
    };
  }

  const config = resolveSeedConfig(allowDefaults);
  if (!config.email || !config.password || !config.name || !config.mobile) {
    return {
      status: "skipped",
      reason: "missing-config",
    };
  }

  if (ensurePbacCatalog) {
    await bootstrapDefaultPbacCatalog();
  }

  const normalizedEmail = config.email.toLowerCase();
  const passwordHash = await hashPassword(config.password);

  const existingByEmail = await userRepository.findByEmail(normalizedEmail);
  const existingByMobile = await userRepository.findByMobile(config.mobile);

  if (
    existingByEmail &&
    existingByMobile &&
    String(existingByEmail._id) !== String(existingByMobile._id)
  ) {
    throw new Error(
      `Cannot seed admin safely. Email ${normalizedEmail} and mobile ${config.mobile} belong to different users.`,
    );
  }

  const targetUser = existingByEmail ?? existingByMobile;

  if (targetUser?.role === "super_admin") {
    return {
      status: "skipped",
      reason: "already-exists",
    };
  }

  const adminUser = targetUser
    ? await userRepository.updateById(String(targetUser._id), {
        name: config.name,
        email: normalizedEmail,
        mobile: config.mobile,
        passwordHash,
        role: "super_admin" as const,
        isActive: true,
      })
    : await userRepository.upsertByEmail(normalizedEmail, {
        name: config.name,
        email: normalizedEmail,
        mobile: config.mobile,
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

  return {
    status: targetUser ? "updated" : "created",
    userId: String(adminUser._id),
    email: normalizedEmail,
    mobile: config.mobile,
  };
}
