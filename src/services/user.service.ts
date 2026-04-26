import crypto from "crypto";
import {
  AdminAccessCollectionKeys,
  AdminAccessCollectionPermissionMap,
  DefaultSubAdminCollectionByRole,
  type AccessCollectionKey,
} from "../config/admin-access-collections";
import { PermissionKeys, type PermissionKey } from "../config/permissions";
import { pbacRepository } from "../repositories/pbac.repository";
import { ApiError } from "../utils/api-error";
import { hashPassword } from "../utils/password";
import { userRepository } from "../repositories/user.repository";
import { invalidatePermissionCache, resolveAccessProfileForUser } from "./pbac.service";
import { UserRole } from "../types/domain";

type SubAdminRole = Extract<UserRole, "vendor_admin" | "accounts_admin">;

function fallbackEmailFromMobile(mobile: string) {
  const safeMobile = mobile.replace(/[^0-9+]/g, "");
  return `${safeMobile}@bookmyevent.local`;
}

const ALLOWED_SUBADMIN_PERMISSION_KEYS = new Set<PermissionKey>([
  PermissionKeys.WorkspaceAdminAccess,
  PermissionKeys.VendorRead,
  PermissionKeys.VendorUpdateAny,
  PermissionKeys.CategoryManage,
  PermissionKeys.LocationManage,
  PermissionKeys.PackagePlatformRead,
  PermissionKeys.PackagePlatformManage,
  PermissionKeys.PackageLeadRead,
  PermissionKeys.PackageLeadUpdate,
  PermissionKeys.PackageVendorRead,
  PermissionKeys.PackageVendorCreateAny,
  PermissionKeys.PackageVendorUpdateAny,
  PermissionKeys.PackageVendorDeleteAny,
  PermissionKeys.BookingReadAny,
  PermissionKeys.BookingUpdateAny,
  PermissionKeys.LeadReadAny,
  PermissionKeys.LeadUpdateAny,
  PermissionKeys.LeadConvertAny,
  PermissionKeys.UserSystemRead,
  PermissionKeys.UserSystemCreate,
  PermissionKeys.UserProfileRead,
  PermissionKeys.UserProfileUpdate,
]);

function normalizePermissionKeys(permissionKeys: string[] | undefined): PermissionKey[] {
  if (!permissionKeys?.length) {
    return [];
  }

  const filtered = permissionKeys.filter((key): key is PermissionKey =>
    ALLOWED_SUBADMIN_PERMISSION_KEYS.has(key as PermissionKey),
  );

  return Array.from(new Set(filtered));
}

const ALLOWED_ACCESS_COLLECTIONS = new Set<AccessCollectionKey>(
  Object.values(AdminAccessCollectionKeys),
);

function normalizeAccessCollections(collections: string[] | undefined): AccessCollectionKey[] {
  if (!collections?.length) {
    return [];
  }

  const filtered = collections.filter((collection): collection is AccessCollectionKey =>
    ALLOWED_ACCESS_COLLECTIONS.has(collection as AccessCollectionKey),
  );

  return Array.from(new Set(filtered));
}

function resolvePermissionKeysFromCollections(
  collections: readonly AccessCollectionKey[],
): PermissionKey[] {
  return Array.from(
    new Set(collections.flatMap((collection) => AdminAccessCollectionPermissionMap[collection] ?? [])),
  );
}

export const userService = {
  getMyProfile: async (userId: string) => {
    const user = await userRepository.findById(userId);
    if (!user) {
      throw new ApiError(404, "User not found");
    }

    return {
      id: user.id,
      name: user.name,
      email: user.email,
      mobile: user.mobile,
      role: user.role,
      isActive: user.isActive,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };
  },

  updateMyProfile: async (
    userId: string,
    payload: {
      name?: string;
      email?: string;
      mobile?: string;
    },
  ) => {
    const user = await userRepository.findById(userId);
    if (!user) {
      throw new ApiError(404, "User not found");
    }

    const updatePayload: { name?: string; email?: string; mobile?: string } = {};

    if (payload.name) {
      updatePayload.name = payload.name.trim();
    }

    if (payload.email) {
      const normalizedEmail = payload.email.trim().toLowerCase();
      const emailOwner = await userRepository.findByEmail(normalizedEmail);
      if (emailOwner && emailOwner.id !== user.id) {
        throw new ApiError(409, "Email already registered");
      }
      updatePayload.email = normalizedEmail;
    }

    if (payload.mobile) {
      const normalizedMobile = payload.mobile.trim();
      const mobileOwner = await userRepository.findByMobile(normalizedMobile);
      if (mobileOwner && mobileOwner.id !== user.id) {
        throw new ApiError(409, "Mobile number already registered");
      }
      updatePayload.mobile = normalizedMobile;
    }

    const updatedUser = await userRepository.updateById(userId, updatePayload);
    if (!updatedUser) {
      throw new ApiError(500, "Unable to update profile");
    }

    return {
      id: updatedUser.id,
      name: updatedUser.name,
      email: updatedUser.email,
      mobile: updatedUser.mobile,
      role: updatedUser.role,
      isActive: updatedUser.isActive,
      createdAt: updatedUser.createdAt,
      updatedAt: updatedUser.updatedAt,
    };
  },

  listSystemUsers: async () => {
    const admins = await Promise.all([
      userRepository.findByRole("super_admin"),
      userRepository.findByRole("vendor_admin"),
      userRepository.findByRole("accounts_admin"),
    ]);

    const users = admins.flat();
    const accessProfiles = await Promise.all(
      users.map((user) => resolveAccessProfileForUser(user.id).catch(() => null)),
    );

    return users.map((user, index) => ({
      id: user.id,
      name: user.name,
      email: user.email,
      mobile: user.mobile,
      role: user.role,
      isActive: user.isActive,
      createdAt: user.createdAt,
      roleKeys: accessProfiles[index]?.roleKeys ?? [],
      permissions: accessProfiles[index]?.permissions ?? [],
    }));
  },

  createSubAdmin: async (payload: {
    name: string;
    mobile: string;
    email?: string;
    role: SubAdminRole;
    accessCollections?: string[];
    permissionKeys?: string[];
  }) => {
    const normalizedMobile = payload.mobile.trim();
    const normalizedEmail = (payload.email?.trim().toLowerCase() || fallbackEmailFromMobile(normalizedMobile));

    const mobileExists = await userRepository.findByMobile(normalizedMobile);
    if (mobileExists) {
      throw new ApiError(409, "Mobile number already registered");
    }

    const emailExists = await userRepository.findByEmail(normalizedEmail);
    if (emailExists) {
      throw new ApiError(409, "Email already registered");
    }

    const temporaryPassword = crypto.randomBytes(16).toString("hex");
    const passwordHash = await hashPassword(temporaryPassword);

    const requestedCollections = normalizeAccessCollections(payload.accessCollections);
    const requestedPermissionKeys = normalizePermissionKeys(payload.permissionKeys);
    const defaultCollections: AccessCollectionKey[] = [
      ...(DefaultSubAdminCollectionByRole[payload.role] ?? []),
    ];

    const effectivePermissionKeys = requestedCollections.length
      ? resolvePermissionKeysFromCollections(requestedCollections)
      : requestedPermissionKeys.length
        ? requestedPermissionKeys
        : resolvePermissionKeysFromCollections(defaultCollections);

    if (!effectivePermissionKeys.length) {
      throw new ApiError(400, "At least one valid permission is required");
    }

    const permissionSet = new Set<PermissionKey>(effectivePermissionKeys);
    permissionSet.add(PermissionKeys.WorkspaceAdminAccess);
    permissionSet.add(PermissionKeys.UserProfileRead);
    permissionSet.add(PermissionKeys.UserProfileUpdate);

    const resolvedPermissionKeys = Array.from(permissionSet);
    await Promise.all(
      resolvedPermissionKeys.map((key) =>
        pbacRepository.upsertPermission(key, `System permission: ${key}`),
      ),
    );

    const user = await userRepository.create({
      name: payload.name.trim(),
      email: normalizedEmail,
      mobile: normalizedMobile,
      passwordHash,
      role: payload.role,
    });

    const dynamicRole = await pbacRepository.upsertCustomRole(
      `staff:${user.id}`,
      `${payload.name.trim()} Access Profile`,
      "Custom access profile configured by super admin",
    );

    if (!dynamicRole) {
      throw new ApiError(500, "Unable to create access profile for system user");
    }

    const permissionDocs = await pbacRepository.listPermissionsByKeys(resolvedPermissionKeys);
    const permissionIds = permissionDocs.map((permission) => String(permission._id));

    if (!permissionIds.length || permissionIds.length < resolvedPermissionKeys.length) {
      throw new ApiError(400, "Selected permissions are not available");
    }

    await pbacRepository.replaceRolePermissions(String(dynamicRole._id), permissionIds);
    await pbacRepository.replaceUserRoles(user.id, [String(dynamicRole._id)]);
    await invalidatePermissionCache(user.id);

    const accessProfile = await resolveAccessProfileForUser(user.id);

    return {
      id: user.id,
      name: user.name,
      email: user.email,
      mobile: user.mobile,
      role: user.role,
      isActive: user.isActive,
      createdAt: user.createdAt,
      roleKeys: accessProfile.roleKeys,
      permissions: accessProfile.permissions,
    };
  },
};
