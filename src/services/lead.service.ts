import { leadRepository } from "../repositories/lead.repository";
import type { UserRole } from "../types/domain";
import { ApiError } from "../utils/api-error";
import { bookingRepository } from "../repositories/booking.repository";
import { availabilityRepository } from "../repositories/availability.repository";
import { resolveVendorIdForAuthUser } from "./vendor-identity.service";

type AuthUser = {
  id: string;
  email: string;
  role: UserRole;
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
  if (authUser.role === "vendor") {
    return resolveVendorIdForAuthUser(authUser);
  }

  return requestedVendorId;
}

export const leadService = {
  createLead: async (payload: Record<string, unknown>, authUser: AuthUser) => {
    const vendorId = await resolveVendorIdForLead(authUser, payload.vendorId as string | undefined);
    if (!vendorId) {
      throw new ApiError(400, "vendorId is required");
    }

    const customerId = authUser.role === "customer" ? authUser.id : String(payload.customerId ?? "");
    if (!customerId) {
      throw new ApiError(400, "customerId is required");
    }

    return leadRepository.create({ ...payload, vendorId, customerId });
  },
  listLeads: async (authUser: AuthUser, filters: Record<string, unknown>) => {
    if (authUser.role === "vendor") {
      const vendorId = await resolveVendorIdForAuthUser(authUser);
      return leadRepository.findByVendor(vendorId);
    }

    if (typeof filters.vendorId === "string" && filters.vendorId) {
      return leadRepository.findByVendor(filters.vendorId);
    }

    return leadRepository.findAll();
  },
  updateLead: async (leadId: string, payload: Record<string, unknown>, authUser: AuthUser) => {
    const existingLead = await leadRepository.findById(leadId);
    if (!existingLead) {
      throw new ApiError(404, "Lead not found");
    }

    if (authUser.role === "vendor") {
      const vendorId = await resolveVendorIdForAuthUser(authUser);
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

    if (authUser.role === "vendor") {
      const vendorId = await resolveVendorIdForAuthUser(authUser);
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
