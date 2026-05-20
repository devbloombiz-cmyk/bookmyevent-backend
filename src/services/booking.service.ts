import { bookingRepository } from "../repositories/booking.repository";
import { availabilityRepository } from "../repositories/availability.repository";
import { PermissionKeys, type PermissionKey } from "../config/permissions";
import type { AuthenticatedUser } from "../types/auth-user";
import { ApiError } from "../utils/api-error";
import {
  resolveVendorIdForAuthUser,
  resolveVendorIdForScopedUser,
  resolveVenueOwnerIdForAuthUser,
} from "./vendor-identity.service";
import { bookingNotificationService } from "./notifications/booking/booking-notification.service";
import { logger } from "../config/logger";
import { paymentRequestService } from "./payment-request.service";
import { activityTimelineService } from "./activity-timeline.service";
import { leadRepository } from "../repositories/lead.repository";
import { userRepository } from "../repositories/user.repository";

type AuthUser = Pick<AuthenticatedUser, "id" | "permissions"> & {
  permissions: PermissionKey[];
};

const validBookingTransitions: Record<string, string[]> = {
  upcoming: ["completed", "cancelled"],
  completed: [],
  cancelled: [],
  // Legacy transitions retained for existing records.
  initiated: ["confirmed", "upcoming", "cancelled"],
  confirmed: ["completed", "cancelled", "upcoming"],
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
    const escaped = candidate.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const regex = new RegExp(`(?:^|\\n)\\s*${escaped}\\s*:\\s*([^\\n\\r]+)`, "i");
    const value = message.match(regex)?.[1]?.trim();
    if (value) {
      return value;
    }
  }

  return "";
}

async function hydrateBookingCustomerDetails(booking: Record<string, unknown>) {
  const lead = booking.leadId ? await leadRepository.findById(String(booking.leadId)) : null;
  const customer = booking.customerId
    ? await userRepository.findById(String(booking.customerId))
    : null;

  const customerName =
    String(booking.customerName || "").trim() ||
    String(customer?.name || "").trim() ||
    String(lead?.customerName || "").trim() ||
    extractFromMessage(String(lead?.message || ""), "Customer") ||
    "Customer";

  const customerMobile =
    normalizeMobile(String(booking.customerMobile || "")) ||
    normalizeMobile(String(customer?.mobile || "")) ||
    normalizeMobile(String(lead?.customerMobile || "")) ||
    normalizeMobile(extractFromMessage(String(lead?.message || ""), "Mobile"));

  const customerEmail =
    String(booking.customerEmail || "").trim() ||
    String(customer?.email || "").trim() ||
    String(lead?.customerEmail || "").trim() ||
    extractFromMessage(String(lead?.message || ""), "Email");

  const nextPayload = {
    customerName,
    customerMobile,
    customerEmail,
  };

  const hasChanges =
    String(booking.customerName || "").trim() !== nextPayload.customerName ||
    String(booking.customerMobile || "").trim() !== nextPayload.customerMobile ||
    String(booking.customerEmail || "").trim() !== nextPayload.customerEmail;

  if (hasChanges && booking._id) {
    const updated = await bookingRepository.updateById(String(booking._id), nextPayload);
    if (updated) {
      return updated;
    }
  }

  return {
    ...booking,
    ...nextPayload,
  };
}

async function filterBookingsByScopedOwnership(
  bookings: Array<Record<string, unknown>>,
  authUser: AuthUser,
) {
  const leadIds = bookings
    .map((item) => String(item.leadId || ""))
    .filter((value) => Boolean(value));
  const uniqueLeadIds = Array.from(new Set(leadIds));
  const leadRows = uniqueLeadIds.length ? await leadRepository.findByIds(uniqueLeadIds) : [];
  const leadById = new Map(leadRows.map((lead) => [String(lead._id), lead]));

  if (authUser.permissions.includes(PermissionKeys.ScopeVenueOwnerOwn)) {
    const venueOwnerId = await resolveVenueOwnerIdForAuthUser(authUser);
    return bookings.filter((booking) => {
      const leadId = String(booking.leadId || "");
      if (!leadId) {
        return false;
      }

      const lead = leadById.get(leadId);
      if (!lead) {
        return false;
      }

      return String(lead.venueOwnerId || "") === venueOwnerId;
    });
  }

  if (authUser.permissions.includes(PermissionKeys.ScopeVendorOwn)) {
    return bookings.filter((booking) => {
      const leadId = String(booking.leadId || "");
      if (!leadId) {
        return true;
      }

      const lead = leadById.get(leadId);
      if (!lead) {
        return true;
      }

      return !lead.venueOwnerId;
    });
  }

  return bookings;
}

async function assertScopedBookingAccess(existing: Record<string, unknown>, authUser: AuthUser) {
  if (authUser.permissions.includes(PermissionKeys.ScopeVenueOwnerOwn)) {
    const venueOwnerId = await resolveVenueOwnerIdForAuthUser(authUser);
    const leadId = String(existing.leadId || "");
    if (!leadId) {
      throw new ApiError(403, "You are not allowed to access this booking");
    }

    const lead = await leadRepository.findById(leadId);
    if (!lead || String(lead.venueOwnerId || "") !== venueOwnerId) {
      throw new ApiError(403, "You are not allowed to access this booking");
    }
  }

  if (authUser.permissions.includes(PermissionKeys.ScopeVendorOwn)) {
    const leadId = String(existing.leadId || "");
    if (!leadId) {
      return;
    }

    const lead = await leadRepository.findById(leadId);
    if (lead?.venueOwnerId) {
      throw new ApiError(403, "You are not allowed to access this booking");
    }
  }
}

export const bookingService = {
  createBooking: async (payload: Record<string, unknown>, authUser: AuthUser) => {
    let booking;

    if (
      authUser.permissions.includes(PermissionKeys.ScopeVendorOwn) ||
      authUser.permissions.includes(PermissionKeys.ScopeVenueOwnerOwn)
    ) {
      const vendorId = authUser.permissions.includes(PermissionKeys.ScopeVendorOwn)
        ? await resolveVendorIdForAuthUser(authUser)
        : await resolveVendorIdForScopedUser(authUser);
      booking = await bookingRepository.create({ ...payload, vendorId });
    } else {
      booking = await bookingRepository.create(payload);
    }

    setImmediate(() => {
      void bookingNotificationService.sendCustomerBookingConfirmation({
        bookingId: String(booking.id),
        customerId: String(booking.customerId),
        vendorId: String(booking.vendorId),
        packageId: String(booking.packageId),
      });
    });

    logger.info(
      {
        event: "booking.notification.dispatch.queued",
        bookingId: String(booking.id),
      },
      "Queued booking notification dispatch",
    );

    if (booking) {
      const amount = Number((booking as { amount?: unknown }).amount || 0);
      const paidAmount = Number(
        (booking as { paidAmount?: unknown; advancePaid?: unknown }).paidAmount ||
          (booking as { advancePaid?: unknown }).advancePaid ||
          0,
      );
      const dueAmount = Math.max(0, amount - paidAmount);

      await bookingRepository.updateById(String(booking.id), {
        paidAmount,
        dueAmount,
        bookingStatus: (booking as { bookingStatus?: unknown }).bookingStatus || "upcoming",
        vendorAmount: amount,
        settledAmount: Number((booking as { settledAmount?: unknown }).settledAmount || 0),
        pendingSettlement: Math.max(
          0,
          amount - Number((booking as { settledAmount?: unknown }).settledAmount || 0),
        ),
      });
    }

    return booking;
  },
  listBookings: async (authUser: AuthUser, filters: Record<string, unknown>) => {
    let bookings;

    if (authUser.permissions.includes(PermissionKeys.ScopeCustomerOwn)) {
      bookings = await bookingRepository.findByCustomer(authUser.id);
    } else if (
      authUser.permissions.includes(PermissionKeys.ScopeVendorOwn) ||
      authUser.permissions.includes(PermissionKeys.ScopeVenueOwnerOwn)
    ) {
      const vendorId = authUser.permissions.includes(PermissionKeys.ScopeVendorOwn)
        ? await resolveVendorIdForAuthUser(authUser)
        : await resolveVendorIdForScopedUser(authUser);
      bookings = await bookingRepository.findByVendor(vendorId);
    } else if (typeof filters.vendorId === "string" && filters.vendorId) {
      bookings = await bookingRepository.findByVendor(filters.vendorId);
    } else {
      bookings = await bookingRepository.findAll();
    }

    bookings = await filterBookingsByScopedOwnership(
      bookings.map((item) => item.toObject() as Record<string, unknown>),
      authUser,
    );

    return Promise.all(bookings.map((booking) => hydrateBookingCustomerDetails(booking)));
  },
  updateBooking: async (
    bookingId: string,
    payload: Record<string, unknown>,
    authUser: AuthUser,
  ) => {
    const existing = await bookingRepository.findById(bookingId);
    if (!existing) {
      throw new ApiError(404, "Booking not found");
    }

    if (
      authUser.permissions.includes(PermissionKeys.ScopeVendorOwn) ||
      authUser.permissions.includes(PermissionKeys.ScopeVenueOwnerOwn)
    ) {
      const vendorId = authUser.permissions.includes(PermissionKeys.ScopeVendorOwn)
        ? await resolveVendorIdForAuthUser(authUser)
        : await resolveVendorIdForScopedUser(authUser);
      if (String(existing.vendorId) !== vendorId) {
        throw new ApiError(403, "You are not allowed to update this booking");
      }

      await assertScopedBookingAccess(existing.toObject() as Record<string, unknown>, authUser);
    }

    if (typeof payload.bookingStatus === "string") {
      const allowed = validBookingTransitions[String(existing.bookingStatus)] ?? [];
      if (!allowed.includes(payload.bookingStatus)) {
        throw new ApiError(
          400,
          `Invalid booking status transition from ${existing.bookingStatus} to ${payload.bookingStatus}`,
        );
      }
    }

    const booking = await bookingRepository.updateById(bookingId, payload);
    if (!booking) {
      throw new ApiError(404, "Booking not found");
    }

    if (typeof payload.bookingStatus === "string" && booking.eventDate && booking.eventSlot) {
      const nextAvailabilityStatus = payload.bookingStatus === "cancelled" ? "available" : "booked";
      await availabilityRepository.upsertSlot({
        vendorId: String(booking.vendorId),
        date: new Date(booking.eventDate),
        slot: String(booking.eventSlot),
        status: nextAvailabilityStatus,
      });

      if (payload.bookingStatus === "completed") {
        await activityTimelineService.addEvent({
          entityType: "booking",
          entityId: String(booking._id),
          vendorId: String(booking.vendorId),
          actorUserId: authUser.id,
          event: "BOOKING_COMPLETED",
          message: "Booking marked completed",
          metadata: {
            reviewPath: `/review/${String(booking._id)}`,
          },
        });
      }
    }

    return booking;
  },
  requestBalancePayment: async (
    bookingId: string,
    payload: {
      amount: number;
      paymentType?: "BALANCE" | "EXTRA";
      notes?: string;
      paymentExpiry?: string;
      sendWhatsApp?: boolean;
      customerMobile?: string;
    },
    authUser: AuthUser,
  ) => {
    return paymentRequestService.createBalanceRequestForBooking(bookingId, payload, authUser);
  },
  sendBalancePaymentLinkToCustomer: async (
    bookingId: string,
    paymentRequestId: string,
    payload: { notes?: string },
    authUser: AuthUser,
  ) => {
    return paymentRequestService.sendBookingBalancePaymentLinkToCustomer(
      bookingId,
      paymentRequestId,
      payload,
      authUser,
    );
  },
  recordManualPayment: async (
    bookingId: string,
    payload: {
      amount: number;
      paymentType?: "BALANCE" | "EXTRA";
      notes?: string;
    },
    authUser: AuthUser,
  ) => {
    return paymentRequestService.recordManualPaymentForBooking(bookingId, payload, authUser);
  },
};
