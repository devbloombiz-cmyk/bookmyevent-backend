import { leadRepository } from "../repositories/lead.repository";
import { PermissionKeys, type PermissionKey } from "../config/permissions";
import type { AuthenticatedUser } from "../types/auth-user";
import { ApiError } from "../utils/api-error";
import { bookingRepository } from "../repositories/booking.repository";
import { availabilityRepository } from "../repositories/availability.repository";
import {
  resolveVendorIdForScopedUser,
  resolveVenueOwnerIdForAuthUser,
} from "./vendor-identity.service";
import { leadNotificationService } from "./notifications/lead/lead-notification.service";
import { logger } from "../config/logger";
import { paymentRequestService } from "./payment-request.service";
import { ultramsgWhatsappService } from "./notifications/whatsapp/ultramsg-whatsapp.service";
import { vendorRepository } from "../repositories/vendor.repository";
import { bookingPolicyService } from "./booking-policy.service";

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
    const regex = new RegExp(
      `(?:^|\\n)\\s*${candidate.replace(/[.*+?^${}()|[\\]\\]/g, "\\$&")}\\s*:\\s*([^\\n\\r]+)`,
      "i",
    );
    const value = message.match(regex)?.[1]?.trim();
    if (value) {
      return value;
    }
  }

  return "";
}

async function trySendLeadReceivedWhatsapp(payload: { mobile: string }) {
  if (!payload.mobile || !ultramsgWhatsappService.isEnabled()) {
    return;
  }

  const message = [
    "Booking Request Received - BookMyEvent",
    "",
    "Dear Customer,",
    "",
    "Your booking request has been successfully received and forwarded to the vendor.",
    "",
    "We are currently waiting for the vendor response regarding confirmation.",
    "",
    "Booking confirmation will be provided after the advance payment is completed.",
    "",
    "Thank you for choosing BookMyEvent.",
    "",
    "Team BookMyEvent",
    "www.bookmyevent.ae",
  ].join("\n");

  await ultramsgWhatsappService.sendMessage({
    to: payload.mobile,
    body: message,
    context: "booking_confirmation",
  });
}

async function trySendLeadCancelledWhatsapp(payload: {
  mobile: string;
  customerName?: string;
  eventDate?: Date;
}) {
  if (!payload.mobile || !ultramsgWhatsappService.isEnabled()) {
    return;
  }

  const eventDateLabel = payload.eventDate
    ? new Intl.DateTimeFormat("en-GB", {
        day: "2-digit",
        month: "long",
        year: "numeric",
      }).format(payload.eventDate)
    : "Not specified";

  const message = [
    "Booking Request Cancelled - BookMyEvent",
    "",
    `Dear ${payload.customerName || "Customer"},`,
    "",
    "Your booking request has been marked as cancelled by the vendor.",
    `Event Date: ${eventDateLabel}`,
    "",
    "For help, please contact Team BookMyEvent.",
    "",
    "Team BookMyEvent",
    "www.bookmyevent.ae",
  ].join("\n");

  await ultramsgWhatsappService.sendMessage({
    to: payload.mobile,
    body: message,
    context: "booking_confirmation",
  });
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

function normalizeReferralCode(rawValue: unknown) {
  if (typeof rawValue !== "string") {
    return "";
  }

  return rawValue.trim().toUpperCase();
}

export const leadService = {
  createLead: async (payload: Record<string, unknown>, authUser: AuthUser) => {
    const isVenueOwnerScope = authUser.permissions.includes(PermissionKeys.ScopeVenueOwnerOwn);
    const isVendorScope = authUser.permissions.includes(PermissionKeys.ScopeVendorOwn);
    const vendorId = await resolveVendorIdForLead(authUser, payload.vendorId as string | undefined);
    if (!vendorId) {
      throw new ApiError(400, "vendorId is required");
    }

    const customerId = authUser.permissions.includes(PermissionKeys.ScopeCustomerOwn)
      ? authUser.id
      : String(payload.customerId ?? "");

    const venueOwnerId = isVenueOwnerScope
      ? await resolveVenueOwnerIdForAuthUser(authUser)
      : isVendorScope
        ? null
        : payload.venueOwnerId;

    const referralCode = normalizeReferralCode(payload.referralCode);
    let referralVendorId: string | null = null;

    if (referralCode) {
      const referralVendor = await vendorRepository.findByReferralCode(referralCode);
      if (
        !referralVendor ||
        !referralVendor.isActive ||
        String(referralVendor.approvalStatus) !== "active"
      ) {
        throw new ApiError(400, "Invalid referral code. Remove or update to continue.");
      }

      referralVendorId = String(referralVendor._id);
    }

    const lead = await leadRepository.create({
      ...payload,
      vendorId,
      venueOwnerId: venueOwnerId || null,
      customerId: customerId || null,
      referralCode,
      referralVendorId,
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

    const customerMobile =
      normalizeMobile(String(lead.customerMobile || "")) ||
      normalizeMobile(extractFromMessage(String(lead.message || ""), "Mobile"));
    if (customerMobile) {
      setImmediate(() => {
        void trySendLeadReceivedWhatsapp({ mobile: customerMobile }).catch((error) => {
          logger.warn(
            {
              leadId: String(lead._id),
              mobile: customerMobile,
              error,
            },
            "Unable to send lead received WhatsApp notification",
          );
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

    if (authUser.permissions.includes(PermissionKeys.ScopeVenueOwnerOwn)) {
      const venueOwnerId = await resolveVenueOwnerIdForAuthUser(authUser);
      return leadRepository.findByVenueOwner(venueOwnerId, requestedStatus);
    }

    if (authUser.permissions.includes(PermissionKeys.ScopeVendorOwn)) {
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

    if (authUser.permissions.includes(PermissionKeys.ScopeVenueOwnerOwn)) {
      const venueOwnerId = await resolveVenueOwnerIdForAuthUser(authUser);
      if (String(existingLead.venueOwnerId || "") !== venueOwnerId) {
        throw new ApiError(403, "You are not allowed to update this lead");
      }
    }

    if (authUser.permissions.includes(PermissionKeys.ScopeVendorOwn)) {
      const vendorId = await resolveVendorIdForScopedUser(authUser);
      if (String(existingLead.vendorId) !== vendorId) {
        throw new ApiError(403, "You are not allowed to update this lead");
      }
    }

    if (typeof payload.status === "string") {
      const currentStatus = String(existingLead.status);
      const allowed = validLeadTransitions[currentStatus] ?? [];
      if (!allowed.includes(payload.status)) {
        throw new ApiError(
          400,
          `Invalid status transition from ${currentStatus} to ${payload.status}`,
        );
      }

      if (payload.status === "BOOKED") {
        await paymentRequestService.finalizeLeadAsBooked(leadId, authUser);
      }

      if (payload.status === "CANCELLED") {
        const customerMobile =
          normalizeMobile(String(existingLead.customerMobile || "")) ||
          normalizeMobile(extractFromMessage(String(existingLead.message || ""), "Mobile"));
        if (customerMobile) {
          setImmediate(() => {
            void trySendLeadCancelledWhatsapp({
              mobile: customerMobile,
              customerName:
                String(existingLead.customerName || "").trim() ||
                extractFromMessage(String(existingLead.message || ""), "Customer") ||
                "Customer",
              eventDate: existingLead.eventDate ? new Date(existingLead.eventDate) : undefined,
            }).catch((error) => {
              logger.warn(
                {
                  leadId,
                  mobile: customerMobile,
                  error,
                },
                "Unable to send lead cancellation WhatsApp notification",
              );
            });
          });
        }
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

    if (authUser.permissions.includes(PermissionKeys.ScopeVenueOwnerOwn)) {
      const venueOwnerId = await resolveVenueOwnerIdForAuthUser(authUser);
      if (String(lead.venueOwnerId || "") !== venueOwnerId) {
        throw new ApiError(403, "You are not allowed to convert this lead");
      }
    }

    if (authUser.permissions.includes(PermissionKeys.ScopeVendorOwn)) {
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
      String(lead.customerName || "").trim() ||
      extractFromMessage(String(lead.message || ""), "Customer");
    const customerMobile =
      normalizeMobile(String(lead.customerMobile || "")) ||
      normalizeMobile(extractFromMessage(String(lead.message || ""), "Mobile"));
    const customerEmail =
      String(lead.customerEmail || "").trim() ||
      extractFromMessage(String(lead.message || ""), "Email");

    const paidAmount = payload.advancePaid ?? 0;
    const dueAmount = Math.max(0, payload.amount - paidAmount);

    await bookingPolicyService.assertBookingConflictFree({
      vendorId: String(lead.vendorId),
      packageId: payload.packageId,
      eventDate: new Date(lead.eventDate),
      venueOwnerId: lead.venueOwnerId ? String(lead.venueOwnerId) : null,
      customerId: lead.customerId ? String(lead.customerId) : "",
      customerMobile,
    });

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
      advancePaid: paidAmount,
      paymentStatus: dueAmount <= 0 ? "paid" : "pending",
      paidAmount,
      dueAmount,
      bookingStatus: "upcoming",
      vendorAmount: payload.amount,
      settledAmount: 0,
      pendingSettlement: payload.amount,
      settlementStatus: "PENDING",
      referralCode: String(lead.referralCode || ""),
      referralVendorId: lead.referralVendorId ?? null,
    });

    await leadRepository.updateById(leadId, {
      status: "BOOKED",
      paymentStatus: dueAmount <= 0 ? "paid" : "pending",
    });

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
    return paymentRequestService.sendOfferPaymentLinkToCustomer(
      leadId,
      paymentRequestId,
      payload,
      authUser,
    );
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
