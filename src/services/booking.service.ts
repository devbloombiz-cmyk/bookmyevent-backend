import { bookingRepository } from "../repositories/booking.repository";
import { availabilityRepository } from "../repositories/availability.repository";
import { PermissionKeys, type PermissionKey } from "../config/permissions";
import type { AuthenticatedUser } from "../types/auth-user";
import { ApiError } from "../utils/api-error";
import { resolveVendorIdForAuthUser } from "./vendor-identity.service";
import { bookingNotificationService } from "./notifications/booking/booking-notification.service";
import { logger } from "../config/logger";

type AuthUser = Pick<AuthenticatedUser, "id" | "permissions"> & {
  permissions: PermissionKey[];
};

const validBookingTransitions: Record<string, string[]> = {
  initiated: ["confirmed", "cancelled"],
  confirmed: ["completed", "cancelled"],
  completed: [],
  cancelled: [],
};

export const bookingService = {
  createBooking: async (payload: Record<string, unknown>, authUser: AuthUser) => {
    let booking;

    if (authUser.permissions.includes(PermissionKeys.ScopeVendorOwn)) {
      const vendorId = await resolveVendorIdForAuthUser(authUser);
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

    return booking;
  },
  listBookings: async (authUser: AuthUser, filters: Record<string, unknown>) => {
    if (authUser.permissions.includes(PermissionKeys.ScopeCustomerOwn)) {
      return bookingRepository.findByCustomer(authUser.id);
    }

    if (authUser.permissions.includes(PermissionKeys.ScopeVendorOwn)) {
      const vendorId = await resolveVendorIdForAuthUser(authUser);
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

    if (authUser.permissions.includes(PermissionKeys.ScopeVendorOwn)) {
      const vendorId = await resolveVendorIdForAuthUser(authUser);
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
    }

    return booking;
  },
};
