import { PermissionKeys, type PermissionKey } from "../config/permissions";
import { userRepository } from "../repositories/user.repository";
import { vendorRepository } from "../repositories/vendor.repository";
import { venueOwnerRepository } from "../repositories/venue-owner.repository";
import { workspaceOperatorRepository } from "../repositories/workspace-operator.repository";
import type { AuthenticatedUser } from "../types/auth-user";
import { ApiError } from "../utils/api-error";

function normalizeVenueTypeToVendorSubCategory(venueType?: string) {
  if (!venueType) {
    return "Venue";
  }

  const normalized = venueType.trim();
  if (!normalized) {
    return "Venue";
  }

  return normalized;
}

export async function resolveVendorIdForAuthUser(authUser: Pick<AuthenticatedUser, "id">) {
  const operatorMapping = await workspaceOperatorRepository.findByOperatorUserId(authUser.id);
  if (operatorMapping?.ownerType === "vendor" && operatorMapping.vendorId) {
    return String(operatorMapping.vendorId);
  }

  if (operatorMapping?.ownerType === "venue_owner" && operatorMapping.venueOwnerId) {
    const venueOwner = await venueOwnerRepository.findById(String(operatorMapping.venueOwnerId));
    if (venueOwner?.linkedVendorId) {
      return String(venueOwner.linkedVendorId);
    }
  }

  const vendorByUserId = await vendorRepository.findByUserId(authUser.id);
  if (vendorByUserId) {
    return String(vendorByUserId._id);
  }

  const user = await userRepository.findById(authUser.id);
  if (!user) {
    throw new ApiError(404, "User not found");
  }

  const vendor = await vendorRepository.findByEmailOrMobile(user.email, user.mobile);
  if (!vendor) {
    throw new ApiError(404, "Vendor profile not found");
  }

  // Auto-heal legacy records by linking userId once discovered.
  if (!vendor.userId) {
    await vendorRepository.updateById(String(vendor._id), {
      userId: authUser.id,
    });
  }

  return String(vendor._id);
}

export async function resolveVendorIdForVenueOwnerAuthUser(
  authUser: Pick<AuthenticatedUser, "id">,
) {
  const operatorMapping = await workspaceOperatorRepository.findByOperatorUserId(authUser.id);
  if (operatorMapping?.ownerType === "venue_owner" && operatorMapping.venueOwnerId) {
    const mappedVenueOwner = await venueOwnerRepository.findById(
      String(operatorMapping.venueOwnerId),
    );
    if (!mappedVenueOwner) {
      throw new ApiError(404, "Venue owner profile not found");
    }

    if (mappedVenueOwner.linkedVendorId) {
      return String(mappedVenueOwner.linkedVendorId);
    }
  }

  const user = await userRepository.findById(authUser.id);
  if (!user) {
    throw new ApiError(404, "User not found");
  }

  const venueOwner = await venueOwnerRepository.findByEmailOrMobile(user.email, user.mobile);
  if (!venueOwner) {
    throw new ApiError(404, "Venue owner profile not found");
  }

  if (venueOwner.linkedVendorId) {
    return String(venueOwner.linkedVendorId);
  }

  const existingVendor = await vendorRepository.findByEmailOrMobile(user.email, user.mobile);
  if (existingVendor) {
    if (!existingVendor.userId) {
      await vendorRepository.updateById(String(existingVendor._id), {
        userId: authUser.id,
      });
    }

    await venueOwnerRepository.updateById(String(venueOwner._id), {
      linkedVendorId: existingVendor._id,
    });

    return String(existingVendor._id);
  }

  const createdVendor = await vendorRepository.create({
    profileType: "venue_owner_shadow",
    userId: authUser.id,
    businessName: venueOwner.businessName,
    ownerName: venueOwner.ownerName,
    email: user.email,
    mobile: user.mobile,
    category: "Venue",
    subCategory: normalizeVenueTypeToVendorSubCategory(venueOwner.venueType),
    state: venueOwner.state || "",
    district: venueOwner.district || "",
    city: venueOwner.city,
    locationDisplayName: venueOwner.locationDisplayName || "",
    locationInputMode: "collection",
    serviceZones: [venueOwner.city, venueOwner.district].filter(Boolean),
    description: venueOwner.description || "",
    coverImage: Array.isArray(venueOwner.profileImages) ? (venueOwner.profileImages[0] ?? "") : "",
    portfolioImages: Array.isArray(venueOwner.profileImages) ? venueOwner.profileImages : [],
    isVerified: false,
    isActive: true,
    approvalStatus: venueOwner.approvalStatus === "disabled" ? "disabled" : "active",
  });

  await venueOwnerRepository.updateById(String(venueOwner._id), {
    linkedVendorId: createdVendor._id,
  });

  return String(createdVendor._id);
}

export async function resolveVenueOwnerIdForAuthUser(authUser: Pick<AuthenticatedUser, "id">) {
  const operatorMapping = await workspaceOperatorRepository.findByOperatorUserId(authUser.id);
  if (operatorMapping?.ownerType === "venue_owner" && operatorMapping.venueOwnerId) {
    return String(operatorMapping.venueOwnerId);
  }

  const venueOwnerByUserId = await venueOwnerRepository.findByUserId(authUser.id);
  if (venueOwnerByUserId) {
    return String(venueOwnerByUserId._id);
  }

  const user = await userRepository.findById(authUser.id);
  if (!user) {
    throw new ApiError(404, "User not found");
  }

  const venueOwner = await venueOwnerRepository.findByEmailOrMobile(user.email, user.mobile);
  if (!venueOwner) {
    throw new ApiError(404, "Venue owner profile not found");
  }

  if (!venueOwner.userId) {
    await venueOwnerRepository.updateById(String(venueOwner._id), {
      userId: authUser.id,
    });
  }

  return String(venueOwner._id);
}

export async function resolveVendorIdForScopedUser(
  authUser: Pick<AuthenticatedUser, "id" | "permissions"> & { permissions: PermissionKey[] },
) {
  if (authUser.permissions.includes(PermissionKeys.ScopeVendorOwn)) {
    return resolveVendorIdForAuthUser(authUser);
  }

  if (authUser.permissions.includes(PermissionKeys.ScopeVenueOwnerOwn)) {
    return resolveVendorIdForVenueOwnerAuthUser(authUser);
  }

  throw new ApiError(403, "No scoped vendor access available");
}
