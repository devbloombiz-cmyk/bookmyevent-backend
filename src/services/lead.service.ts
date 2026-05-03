import { leadRepository } from "../repositories/lead.repository";
import { PermissionKeys, type PermissionKey } from "../config/permissions";
import type { AuthenticatedUser } from "../types/auth-user";
import { ApiError } from "../utils/api-error";
import { bookingRepository } from "../repositories/booking.repository";
import { availabilityRepository } from "../repositories/availability.repository";
import { resolveVendorIdForScopedUser } from "./vendor-identity.service";

type AuthUser = Pick<AuthenticatedUser, "id" | "permissions"> & {
  permissions: PermissionKey[];
};

const validLeadTransitions: Record<string, string[]> = {
  NEW: ["CONTACTED", "CANCELLED"],
  CONTACTED: ["NEGOTIATION", "CANCELLED"],
  NEGOTIATION: ["QUOTE_SENT", "CANCELLED"],
  QUOTE_SENT: ["PAYMENT_PENDING", "CANCELLED"],
  PAYMENT_PENDING: ["PAID", "CANCELLED"],
  PAID: ["CONFIRMED", "CANCELLED"],
  CONFIRMED: ["COMPLETED", "CANCELLED"],
  COMPLETED: [],
  CANCELLED: [],
};

async function resolveVendorIdForLead(authUser: AuthUser, requestedVendorId?: string) {
  if (
    authUser.permissions.includes(PermissionKeys.ScopeVendorOwn) ||
    authUser.permissions.includes(PermissionKeys.ScopeVenueOwnerOwn)
  ) {
    return resolveVendorIdForScopedUser(authUser);
  }

  return requestedVendorId;
}

export const leadService = {
  createLead: async (payload: Record<string, unknown>, authUser: AuthUser) => {
    const vendorId = await resolveVendorIdForLead(authUser, payload.vendorId as string | undefined);
    if (!vendorId) {
      throw new ApiError(400, "vendorId is required");
    }

    const customerId = authUser.permissions.includes(PermissionKeys.ScopeCustomerOwn)
      ? authUser.id
      : String(payload.customerId ?? "");
    if (!customerId) {
      throw new ApiError(400, "customerId is required");
    }

    return leadRepository.create({ ...payload, vendorId, customerId });
  },
  listLeads: async (authUser: AuthUser, filters: Record<string, unknown>) => {
    const requestedStatus = typeof filters.status === "string" ? filters.status : undefined;

    if (
      authUser.permissions.includes(PermissionKeys.ScopeVendorOwn) ||
      authUser.permissions.includes(PermissionKeys.ScopeVenueOwnerOwn)
    ) {
      const vendorId = await resolveVendorIdForScopedUser(authUser);
      return leadRepository.findByVendor(vendorId, requestedStatus);
    }

    if (typeof filters.vendorId === "string" && filters.vendorId) {
      return leadRepository.findByVendor(filters.vendorId, requestedStatus);
    }

    return leadRepository.findAll({ status: requestedStatus });
  },
  updateLead: async (leadId: string, payload: Record<string, unknown>, authUser: AuthUser) => {
    const existingLead = await leadRepository.findById(leadId);
    if (!existingLead) {
      throw new ApiError(404, "Lead not found");
    }

    if (
      authUser.permissions.includes(PermissionKeys.ScopeVendorOwn) ||
      authUser.permissions.includes(PermissionKeys.ScopeVenueOwnerOwn)
    ) {
      const vendorId = await resolveVendorIdForScopedUser(authUser);
      if (String(existingLead.vendorId) !== vendorId) {
        throw new ApiError(403, "You are not allowed to update this lead");
      }
    }

    if (typeof payload.status === "string") {
      const currentStatus = String(existingLead.status);
      const allowed = validLeadTransitions[currentStatus] ?? [];
      if (!allowed.includes(payload.status)) {
        throw new ApiError(400, `Invalid status transition from ${currentStatus} to ${payload.status}`);
      }
    }

    const lead = await leadRepository.updateById(leadId, payload);
    if (!lead) {
      throw new ApiError(404, "Lead not found");
    }

    return lead;
  },
  convertLeadToBooking: async (
    leadId: string,
    payload: { packageId: string; amount: number; advancePaid?: number },
    authUser: AuthUser,
  ) => {
    const lead = await leadRepository.findById(leadId);
    if (!lead) {
      throw new ApiError(404, "Lead not found");
    }

    if (
      authUser.permissions.includes(PermissionKeys.ScopeVendorOwn) ||
      authUser.permissions.includes(PermissionKeys.ScopeVenueOwnerOwn)
    ) {
      const vendorId = await resolveVendorIdForScopedUser(authUser);
      if (String(lead.vendorId) !== vendorId) {
        throw new ApiError(403, "You are not allowed to convert this lead");
      }
    }

    const existingBooking = await bookingRepository.findByLeadId(leadId);
    if (existingBooking) {
      throw new ApiError(409, "This lead is already converted to booking");
    }

    const booking = await bookingRepository.create({
      customerId: lead.customerId,
      vendorId: lead.vendorId,
      leadId: lead._id,
      packageId: payload.packageId,
      eventDate: lead.eventDate,
      eventSlot: lead.eventSlot,
      amount: payload.amount,
      advancePaid: payload.advancePaid ?? 0,
      paymentStatus: payload.advancePaid && payload.advancePaid > 0 ? "paid" : "pending",
      bookingStatus: "confirmed",
    });

    await leadRepository.updateById(leadId, { status: "CONFIRMED", paymentStatus: "paid" });

    if (lead.eventDate && lead.eventSlot) {
      await availabilityRepository.upsertSlot({
        vendorId: String(lead.vendorId),
        date: new Date(lead.eventDate),
        slot: String(lead.eventSlot),
        status: "booked",
      });
    }

    return booking;
  },
};
