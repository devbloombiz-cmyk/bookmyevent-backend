import { packageRepository } from "../repositories/package.repository";
import type { UserRole } from "../types/domain";
import { ApiError } from "../utils/api-error";
import { resolveVendorIdForAuthUser } from "./vendor-identity.service";

type AuthUser = {
  id: string;
  email: string;
  role: UserRole;
};

export const packageService = {
  createVendorPackage: async (payload: Record<string, unknown>, authUser: AuthUser) => {
    if (authUser.role === "vendor") {
      const vendorId = await resolveVendorIdForAuthUser(authUser);
      return packageRepository.createVendorPackage({ ...payload, vendorId });
    }

    return packageRepository.createVendorPackage(payload);
  },
  listVendorPackages: async (
    vendorId: string | undefined,
    includeInactive = false,
    authUser?: AuthUser,
  ) => {
    if (authUser?.role === "vendor") {
      const ownVendorId = await resolveVendorIdForAuthUser(authUser);
      return packageRepository.listVendorPackages(ownVendorId, true);
    }

    return packageRepository.listVendorPackages(vendorId, includeInactive);
  },
  updateVendorPackage: async (packageId: string, payload: Record<string, unknown>, authUser: AuthUser) => {
    const existing = await packageRepository.findVendorPackageById(packageId);
    if (!existing) {
      throw new ApiError(404, "Vendor package not found");
    }

    if (authUser.role === "vendor") {
      const ownVendorId = await resolveVendorIdForAuthUser(authUser);
      if (String(existing.vendorId) !== ownVendorId) {
        throw new ApiError(403, "You are not allowed to update this package");
      }
    }

    const vendorPackage = await packageRepository.updateVendorPackage(packageId, payload);
    if (!vendorPackage) {
      throw new ApiError(404, "Vendor package not found");
    }

    return vendorPackage;
  },
  deleteVendorPackage: async (packageId: string, authUser: AuthUser) => {
    if (authUser.role === "vendor") {
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
