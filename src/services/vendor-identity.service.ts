import { PermissionKeys, type PermissionKey } from "../config/permissions";
import { userRepository } from "../repositories/user.repository";
import { vendorRepository } from "../repositories/vendor.repository";
import { venueOwnerRepository } from "../repositories/venue-owner.repository";
import type { AuthenticatedUser } from "../types/auth-user";
import { ApiError } from "../utils/api-error";

export async function resolveVendorIdForAuthUser(authUser: Pick<AuthenticatedUser, "id">) {
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

export async function resolveVendorIdForVenueOwnerAuthUser(authUser: Pick<AuthenticatedUser, "id">) {
  const user = await userRepository.findById(authUser.id);
  if (!user) {
    throw new ApiError(404, "User not found");
  }

  const venueOwner = await venueOwnerRepository.findByEmailOrMobile(user.email, user.mobile);
  if (!venueOwner) {
    throw new ApiError(404, "Venue owner profile not found");
  }

  if (!venueOwner.linkedVendorId) {
    throw new ApiError(400, "Venue owner is not linked to a vendor profile yet");
  }

  return String(venueOwner.linkedVendorId);
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
