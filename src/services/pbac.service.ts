import type { PermissionKey } from "../config/permissions";
import {
  DefaultLandingByPermissionPriority,
  DefaultRolePermissionKeys,
  PermissionKeys,
  SystemRoleKeys,
} from "../config/permissions";
import { getRedisClient } from "../config/redis";
import { pbacRepository } from "../repositories/pbac.repository";
import { userRepository } from "../repositories/user.repository";

const LOCAL_PERMISSION_CACHE = new Map<string, { expiresAt: number; value: ResolvedAccessProfile }>();
const PERMISSION_CACHE_TTL_MS = 60_000;

type ResolvedAccessProfile = {
  userId: string;
  roleKeys: string[];
  permissions: PermissionKey[];
  defaultLandingPath: string;
};

function buildCacheKey(userId: string) {
  return `pbac:profile:${userId}`;
}

function resolveDefaultLandingPath(permissions: PermissionKey[]) {
  for (const entry of DefaultLandingByPermissionPriority) {
    if (permissions.includes(entry.permission)) {
      return entry.path;
    }
  }

  return "/";
}

function dedupePermissions(permissionKeys: string[]) {
  return Array.from(new Set(permissionKeys)) as PermissionKey[];
}

async function getCachedProfile(userId: string): Promise<ResolvedAccessProfile | null> {
  const now = Date.now();
  const local = LOCAL_PERMISSION_CACHE.get(userId);
  if (local && local.expiresAt > now) {
    return local.value;
  }

  const redisClient = getRedisClient();
  if (!redisClient) {
    return null;
  }

  const redisPayload = await redisClient.get(buildCacheKey(userId));
  if (!redisPayload) {
    return null;
  }

  try {
    const parsed = JSON.parse(redisPayload) as ResolvedAccessProfile;
    LOCAL_PERMISSION_CACHE.set(userId, {
      value: parsed,
      expiresAt: now + PERMISSION_CACHE_TTL_MS,
    });
    return parsed;
  } catch {
    return null;
  }
}

async function setCachedProfile(profile: ResolvedAccessProfile) {
  const now = Date.now();
  LOCAL_PERMISSION_CACHE.set(profile.userId, {
    value: profile,
    expiresAt: now + PERMISSION_CACHE_TTL_MS,
  });

  const redisClient = getRedisClient();
  if (!redisClient) {
    return;
  }

  await redisClient.set(buildCacheKey(profile.userId), JSON.stringify(profile), "EX", 120);
}

export async function invalidatePermissionCache(userId: string) {
  LOCAL_PERMISSION_CACHE.delete(userId);
  const redisClient = getRedisClient();
  if (!redisClient) {
    return;
  }

  await redisClient.del(buildCacheKey(userId));
}

async function resolveLegacyRoleFallback(userId: string) {
  const user = await userRepository.findById(userId);
  if (!user) {
    return [] as string[];
  }

  const role = String(user.role || "").trim();
  return role ? [role] : [];
}

export async function resolveAccessProfileForUser(userId: string): Promise<ResolvedAccessProfile> {
  const cached = await getCachedProfile(userId);
  if (cached) {
    return cached;
  }

  const userRoleRows = await pbacRepository.listRolesByUserId(userId);

  const dynamicRoleKeys = userRoleRows
    .map((row) => {
      const roleDoc = row.roleId as { key?: string } | null;
      return roleDoc?.key?.trim() || "";
    })
    .filter(Boolean);

  const legacyRoleKeys = await resolveLegacyRoleFallback(userId);
  const guaranteedRoleKeys = legacyRoleKeys.includes(SystemRoleKeys.SuperAdmin)
    ? [SystemRoleKeys.SuperAdmin]
    : dynamicRoleKeys.length
      ? []
      : legacyRoleKeys;
  const roleKeys = Array.from(new Set([...dynamicRoleKeys, ...guaranteedRoleKeys]));

  const dynamicRoleIds = userRoleRows
    .map((row) => {
      const roleDoc = row.roleId as { _id?: unknown } | null;
      return roleDoc?._id ? String(roleDoc._id) : "";
    })
    .filter(Boolean);

  const dynamicPermissionRows = dynamicRoleIds.length
    ? await pbacRepository.listPermissionsByRoleIds(dynamicRoleIds)
    : [];

  const dynamicPermissionKeys = dynamicPermissionRows
    .map((row) => {
      const permissionDoc = row.permissionId as { key?: string } | null;
      return permissionDoc?.key?.trim() || "";
    })
    .filter(Boolean);

  const fallbackPermissionKeys = roleKeys.flatMap((roleKey) => DefaultRolePermissionKeys[roleKey] ?? []);

  const permissions = dedupePermissions([...dynamicPermissionKeys, ...fallbackPermissionKeys]);

  const profile: ResolvedAccessProfile = {
    userId,
    roleKeys,
    permissions,
    defaultLandingPath: resolveDefaultLandingPath(permissions),
  };

  await setCachedProfile(profile);
  return profile;
}

export function hasPermission(permissionList: string[], permission: PermissionKey) {
  return permissionList.includes(permission);
}

export async function bootstrapDefaultPbacCatalog() {
  const permissionEntries = Object.values(PermissionKeys).map((key) => ({
    key,
    description: `System permission: ${key}`,
  }));

  for (const permission of permissionEntries) {
    await pbacRepository.upsertPermission(permission.key, permission.description);
  }

  const roleEntries = [
    { key: SystemRoleKeys.SuperAdmin, name: "Super Admin", description: "Platform super administrator" },
    { key: SystemRoleKeys.VendorAdmin, name: "Vendor Admin", description: "Vendor operations administrator" },
    { key: SystemRoleKeys.AccountsAdmin, name: "Accounts Admin", description: "Accounts and package operations administrator" },
    { key: SystemRoleKeys.Vendor, name: "Vendor", description: "Vendor workspace user" },
    { key: SystemRoleKeys.VenueOwner, name: "Venue Owner", description: "Venue owner workspace user" },
    { key: SystemRoleKeys.Customer, name: "Customer", description: "Customer workspace user" },
  ];

  for (const role of roleEntries) {
    await pbacRepository.upsertRole(role.key, role.name, role.description);
  }

  for (const [roleKey, permissionKeys] of Object.entries(DefaultRolePermissionKeys)) {
    const roleDoc = await pbacRepository.findRoleByKey(roleKey);
    if (!roleDoc) {
      continue;
    }

    for (const permissionKey of permissionKeys) {
      const permissionDoc = await pbacRepository.findPermissionByKey(permissionKey);
      if (!permissionDoc) {
        continue;
      }

      await pbacRepository.bindRolePermission(String(roleDoc._id), String(permissionDoc._id));
    }
  }
}
