import { availabilityRepository } from "../repositories/availability.repository";
import { PermissionKeys, type PermissionKey } from "../config/permissions";
import type { AuthenticatedUser } from "../types/auth-user";
import { ApiError } from "../utils/api-error";
import { resolveVendorIdForScopedUser } from "./vendor-identity.service";
import { bookingPolicyService } from "./booking-policy.service";

type AuthUser = Pick<AuthenticatedUser, "id" | "permissions"> & {
  permissions: PermissionKey[];
};

async function resolveTargetVendorIdForWrite(
  payloadVendorId: string | undefined,
  authUser: AuthUser,
) {
  if (
    authUser.permissions.includes(PermissionKeys.ScopeVendorOwn) ||
    authUser.permissions.includes(PermissionKeys.ScopeVenueOwnerOwn)
  ) {
    return resolveVendorIdForScopedUser(authUser);
  }

  if (!payloadVendorId) {
    throw new ApiError(400, "vendorId is required");
  }

  return payloadVendorId;
}

async function resolveTargetVendorIdForList(
  queryVendorId: string | undefined,
  authUser?: AuthUser,
) {
  if (!authUser) {
    if (!queryVendorId) {
      throw new ApiError(400, "vendorId query param is required");
    }
    return queryVendorId;
  }

  if (authUser.permissions.includes(PermissionKeys.ScopeVendorOwn)) {
    return resolveVendorIdForScopedUser(authUser);
  }

  if (authUser.permissions.includes(PermissionKeys.ScopeVenueOwnerOwn)) {
    return resolveVendorIdForScopedUser(authUser);
  }

  return queryVendorId ?? "";
}

export const availabilityService = {
  setAvailability: async (
    payload: { vendorId?: string; date: Date; slot: string; status: string },
    authUser: AuthUser,
  ) => {
    const vendorId = await resolveTargetVendorIdForWrite(payload.vendorId, authUser);
    return availabilityRepository.upsertSlot({
      vendorId,
      date: payload.date,
      slot: payload.slot,
      status: payload.status,
    });
  },
  listByVendor: async (vendorId: string | undefined, authUser?: AuthUser) => {
    const targetVendorId = await resolveTargetVendorIdForList(vendorId, authUser);
    if (!targetVendorId) {
      return [];
    }

    return availabilityRepository.findByVendor(targetVendorId);
  },
  listAvailableVendorIdsByDate: async (date: Date) => {
    return availabilityRepository.listAvailableVendorIdsByDate(date);
  },
  checkBookingAvailability: async (payload: {
    vendorId: string;
    packageId: string;
    eventDate: Date;
    venueOwnerId?: string | null;
    customerId?: string | null;
    customerMobile?: string | null;
  }) => {
    try {
      await bookingPolicyService.assertBookingConflictFree({
        vendorId: payload.vendorId,
        packageId: payload.packageId,
        eventDate: payload.eventDate,
        venueOwnerId: payload.venueOwnerId || null,
        customerId: payload.customerId || "",
        customerMobile: payload.customerMobile || "",
      });

      return {
        available: true,
        message: "Date available",
      };
    } catch (error) {
      if (error instanceof ApiError && error.statusCode === 409) {
        return {
          available: false,
          message: error.message,
        };
      }

      throw error;
    }
  },
};
