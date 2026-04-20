import { availabilityRepository } from "../repositories/availability.repository";
import type { UserRole } from "../types/domain";
import { ApiError } from "../utils/api-error";
import { resolveVendorIdForAuthUser } from "./vendor-identity.service";

type AuthUser = {
  id: string;
  email: string;
  role: UserRole;
};

async function resolveTargetVendorIdForWrite(payloadVendorId: string | undefined, authUser: AuthUser) {
  if (authUser.role === "vendor") {
    return resolveVendorIdForAuthUser(authUser);
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

  if (authUser.role === "vendor") {
    return resolveVendorIdForAuthUser(authUser);
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
};
