import { packageRepository } from "../repositories/package.repository";
import { PermissionKeys, type PermissionKey } from "../config/permissions";
import type { AuthenticatedUser } from "../types/auth-user";
import { ApiError } from "../utils/api-error";
import { resolveVendorIdForAuthUser } from "./vendor-identity.service";
import { subscriptionService } from "./subscription.service";

type AuthUser = Pick<AuthenticatedUser, "id" | "permissions"> & {
  permissions: PermissionKey[];
};

const normalizeUrlArray = (value: unknown, maxItems: number) => {
  if (!Array.isArray(value)) {
    return [] as string[];
  }

  const uniqueValues = Array.from(
    new Set(
      value
        .filter((item): item is string => typeof item === "string")
        .map((item) => item.trim())
        .filter(Boolean),
    ),
  );

  const normalized: string[] = [];
  for (const candidate of uniqueValues) {
    if (normalized.length >= maxItems) {
      break;
    }

    try {
      normalized.push(new URL(candidate).toString());
    } catch {
      continue;
    }
  }

  return normalized;
};

const normalizeVendorPackagePayload = (payload: Record<string, unknown>) => {
  const normalized = { ...payload };

  if ("portfolioImages" in payload) {
    normalized.portfolioImages = normalizeUrlArray(payload.portfolioImages, 4);
  }

  if ("videoLinks" in payload) {
    normalized.videoLinks = normalizeUrlArray(payload.videoLinks, 4);
  }

  return normalized;
};

export const packageService = {
  createVendorPackage: async (payload: Record<string, unknown>, authUser: AuthUser) => {
    const normalizedPayload = normalizeVendorPackagePayload(payload);

    if (authUser.permissions.includes(PermissionKeys.PackageVendorCreateOwn)) {
      const ownVendorId = await resolveVendorIdForAuthUser(authUser);
      const packages = await packageRepository.listVendorPackages(ownVendorId, true);
      await subscriptionService.assertWithinLimit(
        { id: authUser.id, role: "vendor" },
        "maxPackages",
        packages.length + 1,
      );

      return packageRepository.createVendorPackage({ ...normalizedPayload, vendorId: ownVendorId });
    }

    return packageRepository.createVendorPackage(normalizedPayload);
  },
  listVendorPackages: async (
    vendorId: string | undefined,
    includeInactive = false,
    authUser?: AuthUser,
  ) => {
    if (authUser?.permissions.includes(PermissionKeys.ScopeVendorOwn)) {
      const ownVendorId = await resolveVendorIdForAuthUser(authUser);
      return packageRepository.listVendorPackages(ownVendorId, true);
    }

    return packageRepository.listVendorPackages(vendorId, includeInactive);
  },
  updateVendorPackage: async (packageId: string, payload: Record<string, unknown>, authUser: AuthUser) => {
    const normalizedPayload = normalizeVendorPackagePayload(payload);
    const existing = await packageRepository.findVendorPackageById(packageId);
    if (!existing) {
      throw new ApiError(404, "Vendor package not found");
    }

    if (authUser.permissions.includes(PermissionKeys.PackageVendorUpdateOwn)) {
      const ownVendorId = await resolveVendorIdForAuthUser(authUser);
      if (String(existing.vendorId) !== ownVendorId) {
        throw new ApiError(403, "You are not allowed to update this package");
      }
    }

    const vendorPackage = await packageRepository.updateVendorPackage(packageId, normalizedPayload);
    if (!vendorPackage) {
      throw new ApiError(404, "Vendor package not found");
    }

    return vendorPackage;
  },
  deleteVendorPackage: async (packageId: string, authUser: AuthUser) => {
    if (authUser.permissions.includes(PermissionKeys.PackageVendorDeleteOwn)) {
      const existing = await packageRepository.findVendorPackageById(packageId);
      if (!existing) {
        throw new ApiError(404, "Vendor package not found");
      }

      const ownVendorId = await resolveVendorIdForAuthUser(authUser);
      if (String(existing.vendorId) !== ownVendorId) {
        throw new ApiError(403, "You are not allowed to delete this package");
      }
    }

    const vendorPackage = await packageRepository.deleteVendorPackage(packageId);
    if (!vendorPackage) {
      throw new ApiError(404, "Vendor package not found");
    }
    return vendorPackage;
  },
  createPlatformPackage: (payload: Record<string, unknown>) =>
    packageRepository.createPlatformPackage(payload),
  listPlatformPackages: (includeInactive = false) =>
    packageRepository.listPlatformPackages(includeInactive),
  updatePlatformPackage: async (packageId: string, payload: Record<string, unknown>) => {
    const platformPackage = await packageRepository.updatePlatformPackage(packageId, payload);
    if (!platformPackage) {
      throw new ApiError(404, "Platform package not found");
    }
    return platformPackage;
  },
  deletePlatformPackage: async (packageId: string) => {
    const platformPackage = await packageRepository.deletePlatformPackage(packageId);
    if (!platformPackage) {
      throw new ApiError(404, "Platform package not found");
    }
    return platformPackage;
  },
};
