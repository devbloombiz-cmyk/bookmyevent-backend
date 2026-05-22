import crypto from "crypto";
import { PermissionKeys, type PermissionKey } from "../config/permissions";
import { pbacRepository } from "../repositories/pbac.repository";
import { userRepository } from "../repositories/user.repository";
import { workspaceOperatorRepository } from "../repositories/workspace-operator.repository";
import { UserRole } from "../types/domain";
import type { AuthenticatedUser } from "../types/auth-user";
import { ApiError } from "../utils/api-error";
import { hashPassword } from "../utils/password";
import { invalidatePermissionCache, resolveAccessProfileForUser } from "./pbac.service";
import {
  resolveVendorIdForAuthUser,
  resolveVenueOwnerIdForAuthUser,
} from "./vendor-identity.service";

type AuthUser = Pick<AuthenticatedUser, "id" | "permissions"> & {
  permissions: PermissionKey[];
};

type WorkspaceScope = {
  ownerType: "vendor" | "venue_owner";
  ownerId: string;
  operatorRole: Extract<UserRole, "vendor" | "venue_owner">;
  mandatoryPermissions: PermissionKey[];
};

const ALLOWED_OPERATOR_PERMISSION_KEYS = new Set<PermissionKey>([
  PermissionKeys.AvailabilityReadOwn,
  PermissionKeys.AvailabilityWriteOwn,
  PermissionKeys.BookingReadOwnVendor,
  PermissionKeys.BookingUpdateOwnVendor,
  PermissionKeys.LeadReadOwnVendor,
  PermissionKeys.LeadUpdateOwnVendor,
  PermissionKeys.LeadConvertOwnVendor,
  PermissionKeys.PackageVendorRead,
  PermissionKeys.PackageVendorCreateOwn,
  PermissionKeys.PackageVendorUpdateOwn,
  PermissionKeys.PackageVendorDeleteOwn,
  PermissionKeys.VendorRead,
  PermissionKeys.VendorUpdateOwn,
  PermissionKeys.GalleryRead,
  PermissionKeys.GalleryWrite,
  PermissionKeys.UploadImage,
  PermissionKeys.UserProfileRead,
  PermissionKeys.UserProfileUpdate,
]);

function fallbackEmailFromMobile(mobile: string) {
  const safeMobile = mobile.replace(/[^0-9+]/g, "");
  return `${safeMobile}@bookmyevent.local`;
}

function normalizePermissionKeys(permissionKeys: string[] | undefined) {
  if (!permissionKeys?.length) {
    return [] as PermissionKey[];
  }

  const filtered = permissionKeys.filter((key): key is PermissionKey =>
    ALLOWED_OPERATOR_PERMISSION_KEYS.has(key as PermissionKey),
  );

  return Array.from(new Set(filtered));
}

async function resolveWorkspaceScope(authUser: AuthUser): Promise<WorkspaceScope> {
  if (authUser.permissions.includes(PermissionKeys.ScopeVenueOwnerOwn)) {
    return {
      ownerType: "venue_owner",
      ownerId: await resolveVenueOwnerIdForAuthUser(authUser),
      operatorRole: "venue_owner",
      mandatoryPermissions: [
        PermissionKeys.WorkspaceVenueOwnerAccess,
        PermissionKeys.ScopeVenueOwnerOwn,
        PermissionKeys.UserProfileRead,
        PermissionKeys.UserProfileUpdate,
      ],
    };
  }

  if (authUser.permissions.includes(PermissionKeys.ScopeVendorOwn)) {
    return {
      ownerType: "vendor",
      ownerId: await resolveVendorIdForAuthUser(authUser),
      operatorRole: "vendor",
      mandatoryPermissions: [
        PermissionKeys.WorkspaceVendorAccess,
        PermissionKeys.ScopeVendorOwn,
        PermissionKeys.UserProfileRead,
        PermissionKeys.UserProfileUpdate,
      ],
    };
  }

  throw new ApiError(403, "No workspace scope available for operator management");
}

async function resolveOperatorOutput(operatorUserId: string) {
  const user = await userRepository.findById(operatorUserId);
  if (!user) {
    throw new ApiError(404, "Operator user not found");
  }

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
}

export const operatorService = {
  listMyWorkspaceOperators: async (authUser: AuthUser) => {
    const scope = await resolveWorkspaceScope(authUser);
    const rows =
      scope.ownerType === "vendor"
        ? await workspaceOperatorRepository.findByVendor(scope.ownerId)
        : await workspaceOperatorRepository.findByVenueOwner(scope.ownerId);

    const operators = await Promise.all(
      rows.map((row) => resolveOperatorOutput(String(row.operatorUserId))),
    );

    return operators;
  },

  createMyWorkspaceOperator: async (
    payload: {
      name: string;
      mobile: string;
      email?: string;
      permissionKeys: string[];
    },
    authUser: AuthUser,
  ) => {
    const scope = await resolveWorkspaceScope(authUser);

    const normalizedMobile = payload.mobile.trim();
    const normalizedEmail =
      payload.email?.trim().toLowerCase() || fallbackEmailFromMobile(normalizedMobile);

    const mobileExists = await userRepository.findByMobile(normalizedMobile);
    if (mobileExists) {
      throw new ApiError(409, "Mobile number already registered");
    }

    const emailExists = await userRepository.findByEmail(normalizedEmail);
    if (emailExists) {
      throw new ApiError(409, "Email already registered");
    }

    const requestedPermissionKeys = normalizePermissionKeys(payload.permissionKeys);
    if (!requestedPermissionKeys.length) {
      throw new ApiError(400, "At least one valid permission is required");
    }

    const permissionSet = new Set<PermissionKey>([
      ...requestedPermissionKeys,
      ...scope.mandatoryPermissions,
    ]);
    const resolvedPermissionKeys = Array.from(permissionSet);

    await Promise.all(
      resolvedPermissionKeys.map((key) =>
        pbacRepository.upsertPermission(key, `System permission: ${key}`),
      ),
    );

    const temporaryPassword = crypto.randomBytes(16).toString("hex");
    const passwordHash = await hashPassword(temporaryPassword);

    const user = await userRepository.create({
      name: payload.name.trim(),
      email: normalizedEmail,
      mobile: normalizedMobile,
      passwordHash,
      role: scope.operatorRole,
    });

    const dynamicRole = await pbacRepository.upsertCustomRole(
      `workspace-operator:${scope.ownerType}:${scope.ownerId}:${user.id}`,
      `${payload.name.trim()} Operator Access`,
      `Scoped operator access for ${scope.ownerType}`,
    );

    if (!dynamicRole) {
      throw new ApiError(500, "Unable to create operator access profile");
    }

    const permissionDocs = await pbacRepository.listPermissionsByKeys(resolvedPermissionKeys);
    const permissionIds = permissionDocs.map((permission) => String(permission._id));
    if (!permissionIds.length || permissionIds.length < resolvedPermissionKeys.length) {
      throw new ApiError(400, "Selected permissions are not available");
    }

    await pbacRepository.replaceRolePermissions(String(dynamicRole._id), permissionIds);
    await pbacRepository.replaceUserRoles(user.id, [String(dynamicRole._id)]);

    await workspaceOperatorRepository.create(
      scope.ownerType === "vendor"
        ? {
            operatorUserId: user.id,
            ownerType: "vendor",
            vendorId: scope.ownerId,
            createdByUserId: authUser.id,
            isActive: true,
          }
        : {
            operatorUserId: user.id,
            ownerType: "venue_owner",
            venueOwnerId: scope.ownerId,
            createdByUserId: authUser.id,
            isActive: true,
          },
    );

    await invalidatePermissionCache(user.id);
    return resolveOperatorOutput(user.id);
  },

  updateMyWorkspaceOperator: async (
    operatorUserId: string,
    payload: { isActive?: boolean; permissionKeys?: string[] },
    authUser: AuthUser,
  ) => {
    const scope = await resolveWorkspaceScope(authUser);
    const mapping = await workspaceOperatorRepository.findByOwnerAndOperatorUserId({
      ownerType: scope.ownerType,
      ownerId: scope.ownerId,
      operatorUserId,
    });

    if (!mapping) {
      throw new ApiError(404, "Operator not found in your workspace");
    }

    if (payload.isActive !== undefined) {
      await userRepository.updateById(operatorUserId, { isActive: payload.isActive });
      await workspaceOperatorRepository.updateById(String(mapping._id), {
        isActive: payload.isActive,
      });
    }

    if (payload.permissionKeys) {
      const requestedPermissionKeys = normalizePermissionKeys(payload.permissionKeys);
      if (!requestedPermissionKeys.length) {
        throw new ApiError(400, "At least one valid permission is required");
      }

      const resolvedPermissionKeys = Array.from(
        new Set<PermissionKey>([...requestedPermissionKeys, ...scope.mandatoryPermissions]),
      );

      await Promise.all(
        resolvedPermissionKeys.map((key) =>
          pbacRepository.upsertPermission(key, `System permission: ${key}`),
        ),
      );

      const userRoles = await pbacRepository.listRolesByUserId(operatorUserId);
      const roleDoc = userRoles
        .map((row) => row.roleId as { _id?: unknown; key?: string } | null)
        .find((row) => String(row?.key || "").startsWith("workspace-operator:"));

      if (!roleDoc?._id) {
        throw new ApiError(404, "Operator access role not found");
      }

      const permissionDocs = await pbacRepository.listPermissionsByKeys(resolvedPermissionKeys);
      const permissionIds = permissionDocs.map((permission) => String(permission._id));
      if (!permissionIds.length || permissionIds.length < resolvedPermissionKeys.length) {
        throw new ApiError(400, "Selected permissions are not available");
      }

      await pbacRepository.replaceRolePermissions(String(roleDoc._id), permissionIds);
    }

    await invalidatePermissionCache(operatorUserId);
    return resolveOperatorOutput(operatorUserId);
  },
};
