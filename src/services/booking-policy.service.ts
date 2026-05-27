import { bookingRepository } from "../repositories/booking.repository";
import { vendorRepository } from "../repositories/vendor.repository";
import { ApiError } from "../utils/api-error";

type BookingAgainst = "vendor" | "package";

type AssertBookingConflictOptions = {
  vendorId: string;
  packageId: string;
  eventDate: Date;
  venueOwnerId?: string | null;
  excludeBookingId?: string;
};

const normalizeBookingAgainst = (value: unknown): BookingAgainst =>
  String(value || "")
    .trim()
    .toLowerCase() === "vendor"
    ? "vendor"
    : "package";

const resolveBookingAgainstForVendor = async (options: {
  vendorId: string;
  venueOwnerId?: string | null;
}): Promise<BookingAgainst> => {
  if (options.venueOwnerId) {
    return "package";
  }

  const vendor = await vendorRepository.findById(options.vendorId);
  if (!vendor) {
    throw new ApiError(404, "Vendor not found");
  }

  if (String(vendor.profileType || "") === "venue_owner_shadow") {
    return "package";
  }

  return normalizeBookingAgainst((vendor as Record<string, unknown>).bookingAgainst);
};

export const bookingPolicyService = {
  resolveBookingAgainstForVendor,
  assertBookingConflictFree: async (options: AssertBookingConflictOptions) => {
    const bookingAgainst = await resolveBookingAgainstForVendor({
      vendorId: options.vendorId,
      venueOwnerId: options.venueOwnerId,
    });

    if (bookingAgainst === "vendor") {
      const conflict = await bookingRepository.findActiveByVendorAndDate(
        options.vendorId,
        options.eventDate,
        {
          excludeBookingId: options.excludeBookingId,
        },
      );

      if (conflict) {
        throw new ApiError(
          409,
          "This vendor already has a booking on this date. Please select a different date.",
        );
      }

      return;
    }

    const conflict = await bookingRepository.findActiveByVendorPackageAndDate(
      options.vendorId,
      options.packageId,
      options.eventDate,
      {
        excludeBookingId: options.excludeBookingId,
      },
    );

    if (conflict) {
      throw new ApiError(
        409,
        "This package is already booked on this date. Please select another package or date.",
      );
    }
  },
};
