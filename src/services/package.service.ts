import { packageRepository } from "../repositories/package.repository";
import { PermissionKeys, type PermissionKey } from "../config/permissions";
import type { AuthenticatedUser } from "../types/auth-user";
import { ApiError } from "../utils/api-error";
import {
  resolveVendorIdForScopedUser,
  resolveVenueOwnerIdForAuthUser,
} from "./vendor-identity.service";
import { subscriptionService } from "./subscription.service";
import { venueOwnerRepository } from "../repositories/venue-owner.repository";
import { userRepository } from "../repositories/user.repository";
import { deleteManyFromS3 } from "../utils/s3";
import { logger } from "../config/logger";

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

async function seedVenueOwnerPackagesForLinkedVendor(vendorId: string, authUser: AuthUser) {
  const venueOwnerByUserId = await venueOwnerRepository.findByUserId(authUser.id);
  let venueOwner = venueOwnerByUserId;

  if (!venueOwner) {
    const user = await userRepository.findById(authUser.id);
    if (user) {
      venueOwner = await venueOwnerRepository.findByEmailOrMobile(user.email, user.mobile);
    }
  }

  const rawPackages = Array.isArray(
    (venueOwner as { venuePackages?: unknown[] } | null)?.venuePackages,
  )
    ? ((venueOwner as { venuePackages: unknown[] }).venuePackages ?? [])
    : [];

  if (!rawPackages.length) {
    return;
  }

  for (const [index, entry] of rawPackages.entries()) {
    if (!entry || typeof entry !== "object") {
      continue;
    }

    const source = entry as Record<string, unknown>;
    const title = String(source.packageName || "").trim() || `Venue Package ${index + 1}`;
    const price = Math.max(0, Number(source.basePrice ?? source.price ?? 0));
    const description = String(source.description || "").trim();
    const inclusions = Array.isArray(source.inclusions)
      ? source.inclusions
          .filter((item): item is string => typeof item === "string")
          .map((item) => item.trim())
          .filter(Boolean)
      : [];

    const portfolioImages = normalizeUrlArray(source.portfolioImages, 4);
    const videoLinks = normalizeUrlArray(source.videoLinks, 4);

    const venueOwnerId = String((venueOwner as { _id?: unknown } | null)?._id || "");
    if (!venueOwnerId) {
      continue;
    }

    await packageRepository.createVendorPackage({
      vendorId,
      ownerType: "venue_owner",
      venueOwnerId,
      title,
      description,
      price,
      inclusions,
      coverImage: String(source.coverImage || "").trim(),
      portfolioImages,
      videoLinks,
      isActive: source.isActive !== false,
    });
  }
}

export const packageService = {
  createVendorPackage: async (payload: Record<string, unknown>, authUser: AuthUser) => {
    const normalizedPayload = normalizeVendorPackagePayload(payload);

    const hasOwnScope =
      !authUser.permissions.includes(PermissionKeys.PackagePlatformManage) &&
      (authUser.permissions.includes(PermissionKeys.ScopeVendorOwn) ||
        authUser.permissions.includes(PermissionKeys.ScopeVenueOwnerOwn));

    if (authUser.permissions.includes(PermissionKeys.PackageVendorCreateOwn) && hasOwnScope) {
      const ownVendorId = await resolveVendorIdForScopedUser(authUser);
      const actorRole = authUser.permissions.includes(PermissionKeys.ScopeVenueOwnerOwn)
        ? "venue_owner"
        : "vendor";

      const venueOwnerId = authUser.permissions.includes(PermissionKeys.ScopeVenueOwnerOwn)
        ? await resolveVenueOwnerIdForAuthUser(authUser)
        : undefined;
      const packages = authUser.permissions.includes(PermissionKeys.ScopeVenueOwnerOwn)
        ? await packageRepository.listVendorPackagesForVenueOwnerActor(
            ownVendorId,
            String(venueOwnerId),
            true,
          )
        : await packageRepository.listVendorPackagesForVendorActor(ownVendorId, true);
      await subscriptionService.assertWithinLimit(
        { id: authUser.id, role: actorRole },
        "maxPackages",
        packages.length + 1,
      );

      return packageRepository.createVendorPackage({
        ...normalizedPayload,
        vendorId: ownVendorId,
        ownerType: authUser.permissions.includes(PermissionKeys.ScopeVenueOwnerOwn)
          ? "venue_owner"
          : "vendor",
        venueOwnerId: venueOwnerId || null,
      });
    }

    return packageRepository.createVendorPackage(normalizedPayload);
  },
  listVendorPackages: async (
    vendorId: string | undefined,
    includeInactive = false,
    authUser?: AuthUser,
    ownerType?: "vendor" | "venue_owner",
  ) => {
    if (
      authUser &&
      !authUser.permissions.includes(PermissionKeys.PackagePlatformManage) &&
      !authUser.permissions.includes(PermissionKeys.PackagePlatformRead) &&
      (authUser.permissions.includes(PermissionKeys.ScopeVendorOwn) ||
        authUser.permissions.includes(PermissionKeys.ScopeVenueOwnerOwn))
    ) {
      const ownVendorId = await resolveVendorIdForScopedUser(authUser);

      if (authUser.permissions.includes(PermissionKeys.ScopeVenueOwnerOwn)) {
        const ownVenueOwnerId = await resolveVenueOwnerIdForAuthUser(authUser);
        const scopedPackages = await packageRepository.listVendorPackagesForVenueOwnerActor(
          ownVendorId,
          ownVenueOwnerId,
          true,
        );

        if (scopedPackages.length === 0) {
          await seedVenueOwnerPackagesForLinkedVendor(ownVendorId, authUser);
          return packageRepository.listVendorPackagesForVenueOwnerActor(
            ownVendorId,
            ownVenueOwnerId,
            true,
          );
        }

        return scopedPackages;
      }

      return packageRepository.listVendorPackagesForVendorActor(ownVendorId, true);
    }

    if (ownerType === "vendor") {
      if (!vendorId) {
        return [];
      }

      return packageRepository.listVendorPackagesForVendorActor(vendorId, includeInactive);
    }

    if (ownerType === "venue_owner") {
      if (!vendorId) {
        return [];
      }

      return packageRepository
        .listVendorPackages(vendorId, includeInactive)
        .then((rows) =>
          rows.filter(
            (item) =>
              String((item as { ownerType?: unknown }).ownerType || "") === "venue_owner" &&
              Boolean((item as { venueOwnerId?: unknown }).venueOwnerId),
          ),
        );
    }

    return packageRepository.listVendorPackages(vendorId, includeInactive);
  },
  updateVendorPackage: async (
    packageId: string,
    payload: Record<string, unknown>,
    authUser: AuthUser,
  ) => {
    const normalizedPayload = normalizeVendorPackagePayload(payload);
    const existing = await packageRepository.findVendorPackageById(packageId);
    if (!existing) {
      throw new ApiError(404, "Vendor package not found");
    }

    const hasOwnScope =
      !authUser.permissions.includes(PermissionKeys.PackagePlatformManage) &&
      (authUser.permissions.includes(PermissionKeys.ScopeVendorOwn) ||
        authUser.permissions.includes(PermissionKeys.ScopeVenueOwnerOwn));

    if (authUser.permissions.includes(PermissionKeys.PackageVendorUpdateOwn) && hasOwnScope) {
      const ownVendorId = await resolveVendorIdForScopedUser(authUser);
      if (String(existing.vendorId) !== ownVendorId) {
        throw new ApiError(403, "You are not allowed to update this package");
      }

      if (authUser.permissions.includes(PermissionKeys.ScopeVenueOwnerOwn)) {
        const ownVenueOwnerId = await resolveVenueOwnerIdForAuthUser(authUser);
        if (
          String((existing as { ownerType?: unknown }).ownerType || "") !== "venue_owner" ||
          String((existing as { venueOwnerId?: unknown }).venueOwnerId || "") !== ownVenueOwnerId
        ) {
          throw new ApiError(403, "You are not allowed to update this package");
        }
      } else if (String((existing as { ownerType?: unknown }).ownerType || "vendor") !== "vendor") {
        throw new ApiError(403, "You are not allowed to update this package");
      }
    }

    const vendorPackage = await packageRepository.updateVendorPackage(packageId, normalizedPayload);
    if (!vendorPackage) {
      throw new ApiError(404, "Vendor package not found");
    }

    const deletedUrls: string[] = [];

    if ("coverImage" in normalizedPayload) {
      const oldCover = String(existing.coverImage || "").trim();
      const newCover = String(normalizedPayload.coverImage || "").trim();
      if (oldCover && oldCover !== newCover) {
        deletedUrls.push(oldCover);
      }
    }

    if (
      "portfolioImages" in normalizedPayload &&
      Array.isArray(normalizedPayload.portfolioImages)
    ) {
      const oldPortfolio = Array.isArray(existing.portfolioImages) ? existing.portfolioImages : [];
      const newPortfolioSet = new Set(
        normalizedPayload.portfolioImages.map((url) => String(url || "").trim()),
      );

      for (const url of oldPortfolio) {
        const trimmedUrl = String(url || "").trim();
        if (trimmedUrl && !newPortfolioSet.has(trimmedUrl)) {
          deletedUrls.push(trimmedUrl);
        }
      }
    }

    if (deletedUrls.length > 0) {
      deleteManyFromS3(deletedUrls).catch((err) => {
        logger.error({ err, deletedUrls }, "Error in updateVendorPackage S3 cleanup");
      });
    }

    return vendorPackage;
  },
  deleteVendorPackage: async (packageId: string, authUser: AuthUser) => {
    const existing = await packageRepository.findVendorPackageById(packageId);
    if (!existing) {
      throw new ApiError(404, "Vendor package not found");
    }

    const hasOwnScope =
      !authUser.permissions.includes(PermissionKeys.PackagePlatformManage) &&
      (authUser.permissions.includes(PermissionKeys.ScopeVendorOwn) ||
        authUser.permissions.includes(PermissionKeys.ScopeVenueOwnerOwn));

    if (authUser.permissions.includes(PermissionKeys.PackageVendorDeleteOwn) && hasOwnScope) {
      const ownVendorId = await resolveVendorIdForScopedUser(authUser);
      if (String(existing.vendorId) !== ownVendorId) {
        throw new ApiError(403, "You are not allowed to delete this package");
      }

      if (authUser.permissions.includes(PermissionKeys.ScopeVenueOwnerOwn)) {
        const ownVenueOwnerId = await resolveVenueOwnerIdForAuthUser(authUser);
        if (
          String((existing as { ownerType?: unknown }).ownerType || "") !== "venue_owner" ||
          String((existing as { venueOwnerId?: unknown }).venueOwnerId || "") !== ownVenueOwnerId
        ) {
          throw new ApiError(403, "You are not allowed to delete this package");
        }
      } else if (String((existing as { ownerType?: unknown }).ownerType || "vendor") !== "vendor") {
        throw new ApiError(403, "You are not allowed to delete this package");
      }
    }

    const vendorPackage = await packageRepository.deleteVendorPackage(packageId);
    if (!vendorPackage) {
      throw new ApiError(404, "Vendor package not found");
    }

    const urlsToDelete: string[] = [];
    if (existing.coverImage) {
      urlsToDelete.push(String(existing.coverImage));
    }
    if (Array.isArray(existing.portfolioImages)) {
      for (const url of existing.portfolioImages) {
        if (url) urlsToDelete.push(String(url));
      }
    }
    if (urlsToDelete.length > 0) {
      deleteManyFromS3(urlsToDelete).catch((err) => {
        logger.error({ err, urlsToDelete }, "Error deleting vendor package images from S3");
      });
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
