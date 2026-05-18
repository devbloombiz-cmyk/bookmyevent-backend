import { leadRepository } from "../repositories/lead.repository";
import { PermissionKeys, type PermissionKey } from "../config/permissions";
import type { AuthenticatedUser } from "../types/auth-user";
import { ApiError } from "../utils/api-error";
import { bookingRepository } from "../repositories/booking.repository";
import { availabilityRepository } from "../repositories/availability.repository";
import { resolveVendorIdForScopedUser } from "./vendor-identity.service";
import { leadNotificationService } from "./notifications/lead/lead-notification.service";
import { logger } from "../config/logger";
import { paymentRequestService } from "./payment-request.service";

type AuthUser = Pick<AuthenticatedUser, "id" | "permissions"> & {
  permissions: PermissionKey[];
};

const validLeadTransitions: Record<string, string[]> = {
  NEW: ["CONTACTED", "LOST", "CANCELLED"],
  CONTACTED: ["PAYMENT_DONE", "BOOKED", "LOST", "CANCELLED"],
  PAYMENT_DONE: ["BOOKED", "LOST", "CANCELLED"],
  BOOKED: ["COMPLETED", "CANCELLED"],
  LOST: [],
  CANCELLED: [],
  // Legacy transitions retained for historical records.
  NEGOTIATION: ["QUOTE_SENT", "PAYMENT_DONE", "BOOKED", "LOST", "CANCELLED"],
  QUOTE_SENT: ["PAYMENT_PENDING", "PAYMENT_DONE", "BOOKED", "LOST", "CANCELLED"],
  PAYMENT_PENDING: ["PAID", "PAYMENT_DONE", "BOOKED", "LOST", "CANCELLED"],
  PAID: ["CONFIRMED", "PAYMENT_DONE", "BOOKED", "CANCELLED"],
  CONFIRMED: ["COMPLETED", "CANCELLED"],
  COMPLETED: [],
};

function normalizeMobile(rawValue: string) {
  const trimmed = String(rawValue || "").trim();
  const digits = trimmed.replace(/\D/g, "");
  return digits.length >= 10 ? digits : "";
}

function extractFromMessage(message: string | undefined, label: string) {
  if (!message) {
    return "";
  }

  const aliases: Record<string, string[]> = {
    customer: ["Customer Name", "Name"],
    mobile: ["Mobile Number", "Contact", "Contact Number", "Phone", "Phone Number", "WhatsApp"],
    email: ["Email Address", "Mail"],
  };

  const candidates = [label, ...(aliases[label.trim().toLowerCase()] || [])];
  for (const candidate of candidates) {
    const regex = new RegExp(`(?:^|\\n)\\s*${candidate.replace(/[.*+?^${}()|[\\]\\]/g, "\\$&")}\\s*:\\s*([^\\n\\r]+)`, "i");
    const value = message.match(regex)?.[1]?.trim();
    if (value) {
      return value;
    }
  }

  return "";
}

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

    const lead = await leadRepository.create({
      ...payload,
      vendorId,
      customerId: customerId || null,
    });

    if (lead.customerId) {
      setImmediate(() => {
        void leadNotificationService.sendVendorLeadCreatedWhatsapp({
          leadId: String(lead.id),
          vendorId: String(lead.vendorId),
          customerId: String(lead.customerId),
          eventDate: new Date(lead.eventDate),
          eventSlot: String(lead.eventSlot || "Full Day"),
          location: String(lead.location || ""),
        });
      });
    }

    logger.info(
      {
        event: "lead.notification.dispatch.queued",
        leadId: String(lead.id),
        vendorId: String(lead.vendorId),
      },
      "Queued vendor lead notification dispatch",
    );

    return lead;
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

      if (payload.status === "BOOKED") {
        await paymentRequestService.finalizeLeadAsBooked(leadId, authUser);
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

    const customerName =
      String(lead.customerName || "").trim() || extractFromMessage(String(lead.message || ""), "Customer");
    const customerMobile =
      normalizeMobile(String(lead.customerMobile || "")) ||
      normalizeMobile(extractFromMessage(String(lead.message || ""), "Mobile"));
    const customerEmail =
      String(lead.customerEmail || "").trim() || extractFromMessage(String(lead.message || ""), "Email");

    const booking = await bookingRepository.create({
      customerId: lead.customerId ?? null,
      customerName,
      customerMobile,
      customerEmail,
      vendorId: lead.vendorId,
      leadId: lead._id,
      packageId: payload.packageId,
      eventDate: lead.eventDate,
      eventSlot: lead.eventSlot,
      amount: payload.amount,
      advancePaid: payload.advancePaid ?? 0,
      paymentStatus: payload.advancePaid && payload.advancePaid > 0 ? "paid" : "pending",
      paidAmount: payload.advancePaid ?? 0,
      dueAmount: Math.max(0, payload.amount - (payload.advancePaid ?? 0)),
      bookingStatus: "upcoming",
      vendorAmount: payload.amount,
      settledAmount: 0,
      pendingSettlement: payload.amount,
      settlementStatus: "PENDING",
    });

    await leadRepository.updateById(leadId, { status: "BOOKED", paymentStatus: "paid" });

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
  createOfferForLead: async (
    leadId: string,
    payload: {
      packageId: string;
      packageName?: string;
      finalAmount: number;
      advanceAmount: number;
      notes?: string;
      paymentExpiry?: string;
      sendWhatsApp?: boolean;
    },
    authUser: AuthUser,
  ) => {
    return paymentRequestService.createOfferForLead(leadId, payload, authUser);
  },
  sendOfferPaymentLinkToCustomer: async (
    leadId: string,
    paymentRequestId: string,
    payload: { notes?: string },
    authUser: AuthUser,
  ) => {
    return paymentRequestService.sendOfferPaymentLinkToCustomer(leadId, paymentRequestId, payload, authUser);
  },
  recordManualAdvancePaymentForLead: async (
    leadId: string,
    payload: {
      packageId: string;
      packageName?: string;
      finalAmount: number;
      paidAmount: number;
      notes?: string;
      markBooked?: boolean;
    },
    authUser: AuthUser,
  ) => {
    return paymentRequestService.recordManualAdvancePaymentForLead(leadId, payload, authUser);
  },
};
