import { bookingRepository } from "../repositories/booking.repository";
import { availabilityRepository } from "../repositories/availability.repository";
import { PermissionKeys, type PermissionKey } from "../config/permissions";
import type { AuthenticatedUser } from "../types/auth-user";
import { ApiError } from "../utils/api-error";
import { resolveVendorIdForAuthUser, resolveVendorIdForScopedUser } from "./vendor-identity.service";
import { bookingNotificationService } from "./notifications/booking/booking-notification.service";
import { logger } from "../config/logger";
import { paymentRequestService } from "./payment-request.service";
import { activityTimelineService } from "./activity-timeline.service";

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
      const paidAmount = Number((booking as { paidAmount?: unknown; advancePaid?: unknown }).paidAmount || (booking as { advancePaid?: unknown }).advancePaid || 0);
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
    if (authUser.permissions.includes(PermissionKeys.ScopeCustomerOwn)) {
      return bookingRepository.findByCustomer(authUser.id);
    }

    if (
      authUser.permissions.includes(PermissionKeys.ScopeVendorOwn) ||
      authUser.permissions.includes(PermissionKeys.ScopeVenueOwnerOwn)
    ) {
      const vendorId = authUser.permissions.includes(PermissionKeys.ScopeVendorOwn)
        ? await resolveVendorIdForAuthUser(authUser)
        : await resolveVendorIdForScopedUser(authUser);
      return bookingRepository.findByVendor(vendorId);
    }

    if (typeof filters.vendorId === "string" && filters.vendorId) {
      return bookingRepository.findByVendor(filters.vendorId);
    }

    return bookingRepository.findAll();
  },
  updateBooking: async (bookingId: string, payload: Record<string, unknown>, authUser: AuthUser) => {
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
};
