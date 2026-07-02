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
import { vendorRepository } from "../repositories/vendor.repository";
import { bookingPolicyService } from "./booking-policy.service";
import { paymentRequestRepository } from "../repositories/payment-request.repository";

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

function toDateOnly(value: Date) {
  return new Date(value.getFullYear(), value.getMonth(), value.getDate());
}

function isFutureEventDate(value: unknown) {
  const parsed = new Date(String(value || ""));
  if (Number.isNaN(parsed.getTime())) {
    return false;
  }

  const today = toDateOnly(new Date());
  const eventDate = toDateOnly(parsed);
  return eventDate.getTime() > today.getTime();
}

function normalizeBookingAmounts(payload: Record<string, unknown>) {
  const amount = Number(payload.amount || 0);
  const advancePaid = Number(payload.advancePaid || 0);
  const explicitPaidAmount = Number(payload.paidAmount);
  const paidAmount = Number.isFinite(explicitPaidAmount)
    ? explicitPaidAmount
    : Number.isFinite(advancePaid)
      ? advancePaid
      : 0;

  if (!Number.isFinite(amount) || amount < 0) {
    throw new ApiError(400, "amount must be a valid positive number");
  }

  if (!Number.isFinite(advancePaid) || advancePaid < 0) {
    throw new ApiError(400, "advancePaid must be a valid positive number");
  }

  if (advancePaid > amount) {
    throw new ApiError(400, "advancePaid cannot exceed total amount");
  }

  if (!Number.isFinite(paidAmount) || paidAmount < 0) {
    throw new ApiError(400, "paidAmount must be a valid positive number");
  }

  const normalizedPaidAmount = Math.max(paidAmount, advancePaid);
  if (normalizedPaidAmount > amount) {
    throw new ApiError(400, "paidAmount cannot exceed total amount");
  }

  return {
    amount,
    advancePaid,
    paidAmount: normalizedPaidAmount,
    dueAmount: Math.max(0, amount - normalizedPaidAmount),
  };
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
  if (authUser.permissions.includes(PermissionKeys.BookingReadAny)) {
    return bookings;
  }

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
  if (
    authUser.permissions.includes(PermissionKeys.BookingUpdateAny) ||
    authUser.permissions.includes(PermissionKeys.BookingReadAny)
  ) {
    return;
  }

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
    if (
      String(payload.bookingStatus || "") === "completed" &&
      isFutureEventDate(payload.eventDate)
    ) {
      throw new ApiError(400, "Booking can be marked completed only on or after event date");
    }

    const normalizedAmounts = normalizeBookingAmounts(payload);
    const normalizedPayload: Record<string, unknown> = {
      ...payload,
      ...normalizedAmounts,
      vendorAmount: normalizedAmounts.amount,
      settledAmount: Number(payload.settledAmount || 0),
      pendingSettlement: Math.max(0, normalizedAmounts.amount - Number(payload.settledAmount || 0)),
    };

    let targetVendorId = String(normalizedPayload["vendorId"] || "");
    if (
      !authUser.permissions.includes(PermissionKeys.BookingReadAny) &&
      (authUser.permissions.includes(PermissionKeys.ScopeVendorOwn) ||
        authUser.permissions.includes(PermissionKeys.ScopeVenueOwnerOwn))
    ) {
      targetVendorId = authUser.permissions.includes(PermissionKeys.ScopeVendorOwn)
        ? await resolveVendorIdForAuthUser(authUser)
        : await resolveVendorIdForScopedUser(authUser);
    }

    const nextBookingStatus = String(normalizedPayload["bookingStatus"] || "upcoming");
    if (nextBookingStatus !== "cancelled") {
      const leadId = String(normalizedPayload["leadId"] || "");
      const lead = leadId ? await leadRepository.findById(leadId) : null;

      await bookingPolicyService.assertBookingConflictFree({
        vendorId: targetVendorId,
        packageId: String(normalizedPayload["packageId"] || ""),
        eventDate: new Date(String(normalizedPayload["eventDate"] || "")),
        venueOwnerId: lead?.venueOwnerId ? String(lead.venueOwnerId) : null,
        customerId: String(normalizedPayload["customerId"] || ""),
        customerMobile: String(normalizedPayload["customerMobile"] || ""),
      });
    }

    let booking;

    if (
      !authUser.permissions.includes(PermissionKeys.BookingReadAny) &&
      (authUser.permissions.includes(PermissionKeys.ScopeVendorOwn) ||
        authUser.permissions.includes(PermissionKeys.ScopeVenueOwnerOwn))
    ) {
      booking = await bookingRepository.create({ ...normalizedPayload, vendorId: targetVendorId });
    } else {
      booking = await bookingRepository.create(normalizedPayload);
    }

    if (booking.eventDate && booking.eventSlot && booking.bookingStatus !== "cancelled") {
      await availabilityRepository.upsertSlot({
        vendorId: String(booking.vendorId),
        date: new Date(booking.eventDate),
        slot: String(booking.eventSlot),
        status: "booked",
      });
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

    return booking;
  },
  listBookings: async (authUser: AuthUser, filters: Record<string, unknown>) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let bookings: any[];

    if (authUser.permissions.includes(PermissionKeys.BookingReadAny)) {
      if (typeof filters.vendorId === "string" && filters.vendorId) {
        bookings = await bookingRepository.findByVendor(filters.vendorId);
      } else {
        bookings = await bookingRepository.findAll();
      }
    } else if (authUser.permissions.includes(PermissionKeys.ScopeCustomerOwn)) {
      bookings = await bookingRepository.findByCustomer(authUser.id);
    } else if (
      authUser.permissions.includes(PermissionKeys.ScopeVendorOwn) ||
      authUser.permissions.includes(PermissionKeys.ScopeVenueOwnerOwn)
    ) {
      const vendorId = authUser.permissions.includes(PermissionKeys.ScopeVendorOwn)
        ? await resolveVendorIdForAuthUser(authUser)
        : await resolveVendorIdForScopedUser(authUser);
      bookings = await bookingRepository.findByVendor(vendorId);
    } else {
      bookings = [];
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

    const oldDate = existing.eventDate;
    const oldSlot = existing.eventSlot;
    const oldVendorId = existing.vendorId;

    if (
      !authUser.permissions.includes(PermissionKeys.BookingUpdateAny) &&
      !authUser.permissions.includes(PermissionKeys.BookingReadAny) &&
      (authUser.permissions.includes(PermissionKeys.ScopeVendorOwn) ||
        authUser.permissions.includes(PermissionKeys.ScopeVenueOwnerOwn))
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

      const effectiveEventDate =
        payload.eventDate !== undefined
          ? payload.eventDate
          : (existing as { eventDate?: unknown }).eventDate;
      if (payload.bookingStatus === "completed" && isFutureEventDate(effectiveEventDate)) {
        throw new ApiError(400, "Booking can be marked completed only on or after event date");
      }
    }

    const effectiveEventDate =
      payload.eventDate !== undefined
        ? payload.eventDate
        : (existing as { eventDate?: unknown }).eventDate;

    if (payload.settlementStatus === "SETTLED" && isFutureEventDate(effectiveEventDate)) {
      throw new ApiError(400, "Booking can be marked settled only on or after event date");
    }

    if (
      payload.settlementStatus !== undefined ||
      payload.settledAmount !== undefined ||
      payload.pendingSettlement !== undefined
    ) {
      const vendorAmount = Math.max(0, Number(existing.vendorAmount || existing.amount || 0));

      let nextSettledAmount =
        payload.settledAmount !== undefined
          ? Number(payload.settledAmount)
          : Number(existing.settledAmount || 0);

      if (!Number.isFinite(nextSettledAmount) || nextSettledAmount < 0) {
        throw new ApiError(400, "settledAmount must be a valid positive number");
      }

      if (payload.settlementStatus === "SETTLED") {
        nextSettledAmount = vendorAmount;
      }

      if (nextSettledAmount > vendorAmount) {
        throw new ApiError(400, "settledAmount cannot exceed vendor amount");
      }

      const pendingSettlement = Math.max(0, vendorAmount - nextSettledAmount);

      payload.settledAmount = nextSettledAmount;
      payload.pendingSettlement = pendingSettlement;
      payload.settlementStatus = pendingSettlement <= 0 ? "SETTLED" : "PENDING";
    }

    if (
      payload.amount !== undefined ||
      payload.advancePaid !== undefined ||
      payload.paidAmount !== undefined ||
      payload.dueAmount !== undefined
    ) {
      const mergedAmounts = normalizeBookingAmounts({
        amount: payload.amount ?? existing.amount,
        advancePaid: payload.advancePaid ?? existing.advancePaid,
        paidAmount: payload.paidAmount ?? existing.paidAmount,
      });
      payload.amount = mergedAmounts.amount;
      payload.advancePaid = mergedAmounts.advancePaid;
      payload.paidAmount = mergedAmounts.paidAmount;
      payload.dueAmount = mergedAmounts.dueAmount;
    }

    const effectiveBookingStatus = String(payload.bookingStatus ?? existing.bookingStatus);
    const shouldValidateConflict =
      effectiveBookingStatus !== "cancelled" &&
      (payload.eventDate !== undefined || payload.bookingStatus !== undefined);

    if (shouldValidateConflict) {
      const eventDate =
        payload.eventDate !== undefined
          ? new Date(String(payload.eventDate))
          : new Date(String(existing.eventDate));

      const packageId = String(existing.packageId || "");
      const vendorId = String(existing.vendorId || "");
      const leadId = String(existing.leadId || "");
      const lead = leadId ? await leadRepository.findById(leadId) : null;

      await bookingPolicyService.assertBookingConflictFree({
        vendorId,
        packageId,
        eventDate,
        venueOwnerId: lead?.venueOwnerId ? String(lead.venueOwnerId) : null,
        excludeBookingId: bookingId,
        customerId: String(existing.customerId || ""),
        customerMobile: String(existing.customerMobile || ""),
      });
    }

    const booking = await bookingRepository.updateById(bookingId, payload);
    if (!booking) {
      throw new ApiError(404, "Booking not found");
    }

    if (booking.eventDate && booking.eventSlot) {
      const isCancelled = String(payload.bookingStatus ?? booking.bookingStatus) === "cancelled";
      const nextAvailabilityStatus = isCancelled ? "available" : "booked";

      const dateChanged =
        oldDate && new Date(oldDate).getTime() !== new Date(booking.eventDate).getTime();
      const slotChanged = oldSlot && String(oldSlot) !== String(booking.eventSlot);
      const vendorChanged = oldVendorId && String(oldVendorId) !== String(booking.vendorId);

      if (dateChanged || slotChanged || vendorChanged) {
        if (oldDate && oldSlot && oldVendorId) {
          await availabilityRepository.upsertSlot({
            vendorId: String(oldVendorId),
            date: new Date(oldDate),
            slot: String(oldSlot),
            status: "available",
          });
        }
      }

      await availabilityRepository.upsertSlot({
        vendorId: String(booking.vendorId),
        date: new Date(booking.eventDate),
        slot: String(booking.eventSlot),
        status: nextAvailabilityStatus,
      });
    }

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
  listBookingPaymentRequests: async (bookingId: string, authUser: AuthUser) => {
    const existing = await bookingRepository.findById(bookingId);
    if (!existing) {
      throw new ApiError(404, "Booking not found");
    }

    if (
      !authUser.permissions.includes(PermissionKeys.BookingReadAny) &&
      (authUser.permissions.includes(PermissionKeys.ScopeVendorOwn) ||
        authUser.permissions.includes(PermissionKeys.ScopeVenueOwnerOwn))
    ) {
      const vendorId = authUser.permissions.includes(PermissionKeys.ScopeVendorOwn)
        ? await resolveVendorIdForAuthUser(authUser)
        : await resolveVendorIdForScopedUser(authUser);

      if (String(existing.vendorId) !== vendorId) {
        throw new ApiError(403, "You are not allowed to access this booking");
      }

      await assertScopedBookingAccess(existing.toObject() as Record<string, unknown>, authUser);
    }

    const paymentRequests = await paymentRequestRepository.findByBookingId(bookingId);
    return paymentRequests.map((item) => item.toObject() as Record<string, unknown>);
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
  markPaymentRequestReceived: async (
    bookingId: string,
    paymentRequestId: string,
    payload: { amount: number; note?: string },
    authUser: AuthUser,
  ) => {
    return paymentRequestService.markBookingPaymentRequestReceived(
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
  listMyReferralBookings: async (authUser: AuthUser) => {
    const vendorId = await resolveVendorIdForAuthUser(authUser);
    const rows = await bookingRepository.findByReferralVendorId(vendorId);
    const bookings = rows.map((item) => item.toObject() as Record<string, unknown>);

    const relatedVendorIds = Array.from(
      new Set(bookings.map((item) => String(item.vendorId || "")).filter((id) => Boolean(id))),
    );
    const bookedVendors = relatedVendorIds.length
      ? await vendorRepository.findByIds(relatedVendorIds)
      : [];
    const bookedVendorMap = new Map(
      bookedVendors.map((vendor) => [
        String(vendor._id),
        {
          businessName: String(vendor.businessName || ""),
          category: String(vendor.category || ""),
        },
      ]),
    );

    const enhancedBookings = bookings.map((booking) => ({
      ...booking,
      bookedVendor: bookedVendorMap.get(String(booking.vendorId || "")) || null,
    }));

    const summary = {
      totalReferrals: bookings.length,
      completedReferrals: bookings.filter(
        (item) => String(item.bookingStatus || "") === "completed",
      ).length,
      totalAmount: bookings.reduce((acc, item) => acc + Number(item.amount || 0), 0),
    };

    return { summary, bookings: enhancedBookings };
  },
  listAdminReferralInsights: async (limit = 100) => {
    const normalizedLimit = Math.max(1, Math.min(500, Number(limit) || 100));
    const [leaderboardRows, bookingRows] = await Promise.all([
      bookingRepository.aggregateReferralLeaderboard(normalizedLimit),
      bookingRepository.findAllWithReferral(normalizedLimit),
    ]);

    const referralVendorIds = Array.from(
      new Set(
        leaderboardRows
          .map((item) => String((item as { _id?: unknown })._id || ""))
          .filter((id) => Boolean(id)),
      ),
    );
    const bookingVendorIds = Array.from(
      new Set(bookingRows.map((item) => String(item.vendorId || "")).filter((id) => Boolean(id))),
    );

    const vendorRows = await vendorRepository.findByIds(
      Array.from(new Set([...referralVendorIds, ...bookingVendorIds])),
    );
    const vendorMap = new Map(
      vendorRows.map((vendor) => {
        const row = vendor.toObject() as Record<string, unknown>;
        return [
          String(vendor._id),
          {
            businessName: String(vendor.businessName || ""),
            referralCode: String(row.referralCode || ""),
          },
        ];
      }),
    );

    const leaderboard = leaderboardRows.map((row, index) => {
      const vendorId = String((row as { _id?: unknown })._id || "");
      const vendor = vendorMap.get(vendorId) || { businessName: "", referralCode: "" };

      return {
        rank: index + 1,
        referralVendorId: vendorId,
        referralVendorName: vendor.businessName,
        referralCode: vendor.referralCode,
        totalReferrals: Number((row as { totalReferrals?: unknown }).totalReferrals || 0),
        completedReferrals: Number(
          (row as { completedReferrals?: unknown }).completedReferrals || 0,
        ),
        totalAmount: Number((row as { totalAmount?: unknown }).totalAmount || 0),
      };
    });

    const bookings = bookingRows.map((item) => {
      const row = item.toObject() as Record<string, unknown>;
      const referralVendorId = String(row.referralVendorId || "");
      const bookedVendorId = String(row.vendorId || "");

      return {
        ...row,
        referralVendor: referralVendorId ? vendorMap.get(referralVendorId) || null : null,
        bookedVendor: bookedVendorId ? vendorMap.get(bookedVendorId) || null : null,
      };
    });

    return {
      summary: {
        totalReferralBookings: bookings.length,
        uniqueReferralVendors: leaderboard.length,
      },
      leaderboard,
      bookings,
    };
  },
};
