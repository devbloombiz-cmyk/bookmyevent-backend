import { bookingRepository } from "../repositories/booking.repository";
import { leadRepository } from "../repositories/lead.repository";
import { reviewRepository } from "../repositories/review.repository";
import { vendorRepository } from "../repositories/vendor.repository";
import { venueOwnerRepository } from "../repositories/venue-owner.repository";
import { PermissionKeys, type PermissionKey } from "../config/permissions";
import type { AuthenticatedUser } from "../types/auth-user";
import { ApiError } from "../utils/api-error";
import { resolveVendorIdForScopedUser } from "./vendor-identity.service";

type AuthUser = Pick<AuthenticatedUser, "id" | "name" | "permissions"> & {
  permissions: PermissionKey[];
};

type SubjectType = "vendor" | "venue_owner";

type ReviewContext = {
  bookingId: string;
  subjectType: SubjectType;
  subjectId: string;
  subjectLabel: string;
  existingReview: Record<string, unknown> | null;
  canReview: boolean;
};

const isReviewEligibleStatus = (status: string) => status === "confirmed" || status === "completed";

async function resolveReviewSubjectFromBooking(booking: Record<string, unknown>): Promise<{
  subjectType: SubjectType;
  subjectId: string;
  subjectLabel: string;
  vendorId: string;
  venueOwnerId?: string;
}> {
  const vendorId = String(booking.vendorId ?? "");
  if (!vendorId) {
    throw new ApiError(400, "Invalid booking reference");
  }

  const leadId = booking.leadId ? String(booking.leadId) : "";

  if (leadId) {
    const lead = await leadRepository.findById(leadId);
    if (lead?.venueOwnerId) {
      const venueOwnerId = String(lead.venueOwnerId);
      const venueOwner = await venueOwnerRepository.findById(venueOwnerId);
      return {
        subjectType: "venue_owner",
        subjectId: venueOwnerId,
        subjectLabel: String(venueOwner?.businessName || "Venue Owner"),
        vendorId,
        venueOwnerId,
      };
    }
  }

  const vendor = await vendorRepository.findById(vendorId);
  return {
    subjectType: "vendor",
    subjectId: vendorId,
    subjectLabel: String(vendor?.businessName || "Vendor"),
    vendorId,
  };
}

async function syncSubjectRating(subjectType: SubjectType, subjectId: string) {
  const summary = await reviewRepository.summarizeBySubject(subjectType, subjectId);

  if (subjectType === "vendor") {
    await vendorRepository.updateById(subjectId, {
      rating: summary.avgRating,
      reviewCount: summary.totalReviews,
    });
    return;
  }

  await venueOwnerRepository.updateById(subjectId, {
    rating: summary.avgRating,
    reviewCount: summary.totalReviews,
  });
}

export const reviewService = {
  createReview: async (
    payload: { bookingId: string; rating: number; title: string; message: string },
    authUser: AuthUser,
  ) => {
    if (!authUser.permissions.includes(PermissionKeys.ScopeCustomerOwn)) {
      throw new ApiError(403, "Only customers can submit reviews");
    }

    const booking = await bookingRepository.findById(payload.bookingId);
    if (!booking) {
      throw new ApiError(404, "Booking not found");
    }

    if (String(booking.customerId) !== authUser.id) {
      throw new ApiError(403, "You are not allowed to review this booking");
    }

    if (!isReviewEligibleStatus(String(booking.bookingStatus ?? ""))) {
      throw new ApiError(400, "Review is allowed only for confirmed or completed bookings");
    }

    const existing = await reviewRepository.findByBookingId(payload.bookingId);
    if (existing) {
      throw new ApiError(409, "A review already exists for this booking");
    }

    const subject = await resolveReviewSubjectFromBooking(booking.toObject() as Record<string, unknown>);

    const review = await reviewRepository.create({
      bookingId: payload.bookingId,
      customerId: authUser.id,
      customerName: authUser.name || "Verified User",
      subjectType: subject.subjectType,
      subjectId: subject.subjectId,
      vendorId: subject.vendorId,
      venueOwnerId: subject.venueOwnerId || null,
      rating: payload.rating,
      title: payload.title,
      message: payload.message,
      isVerifiedBooking: true,
      isActive: true,
    });

    await syncSubjectRating(subject.subjectType, subject.subjectId);

    return review;
  },

  getBookingReviewContext: async (bookingId: string, authUser: AuthUser): Promise<ReviewContext> => {
    const booking = await bookingRepository.findById(bookingId);
    if (!booking) {
      throw new ApiError(404, "Booking not found");
    }

    if (String(booking.customerId) !== authUser.id) {
      throw new ApiError(403, "You are not allowed to access this booking");
    }

    const subject = await resolveReviewSubjectFromBooking(booking.toObject() as Record<string, unknown>);
    const existing = await reviewRepository.findByBookingId(bookingId);

    return {
      bookingId,
      subjectType: subject.subjectType,
      subjectId: subject.subjectId,
      subjectLabel: subject.subjectLabel,
      existingReview: existing ? (existing.toObject() as Record<string, unknown>) : null,
      canReview:
        isReviewEligibleStatus(String(booking.bookingStatus ?? "")) &&
        !existing &&
        authUser.permissions.includes(PermissionKeys.ScopeCustomerOwn),
    };
  },

  listPublicReviews: async (params: {
    subjectType: SubjectType;
    subjectId: string;
    page: number;
    limit: number;
    rating?: number;
  }) => {
    const [reviews, total] = await Promise.all([
      reviewRepository.findPublicBySubject(params),
      reviewRepository.countPublicBySubject(params),
    ]);

    return {
      reviews,
      page: params.page,
      limit: params.limit,
      total,
      totalPages: Math.max(1, Math.ceil(total / params.limit)),
    };
  },

  getSummary: async (subjectType: SubjectType, subjectId: string) => {
    const [summary, breakdown] = await Promise.all([
      reviewRepository.summarizeBySubject(subjectType, subjectId),
      reviewRepository.ratingBreakdownBySubject(subjectType, subjectId),
    ]);

    return {
      averageRating: summary.avgRating,
      totalReviews: summary.totalReviews,
      breakdown,
    };
  },

  listOwnerDashboardReviews: async (
    authUser: AuthUser,
    params: { page: number; limit: number; search?: string; rating?: number },
  ) => {
    let subjectType: SubjectType;
    let subjectId: string;

    if (authUser.permissions.includes(PermissionKeys.ScopeVenueOwnerOwn)) {
      const vendorId = await resolveVendorIdForScopedUser(authUser);
      const venue = await venueOwnerRepository.findByLinkedVendorId(vendorId);
      if (!venue) {
        throw new ApiError(404, "Venue owner profile not found");
      }
      subjectType = "venue_owner";
      subjectId = String(venue._id);
    } else if (authUser.permissions.includes(PermissionKeys.ScopeVendorOwn)) {
      subjectType = "vendor";
      subjectId = await resolveVendorIdForScopedUser(authUser);
    } else {
      throw new ApiError(403, "Review dashboard is restricted to vendor and venue owner accounts");
    }

    const [rows, total, summary] = await Promise.all([
      reviewRepository.listForOwnerDashboard({ subjectType, subjectId, ...params }),
      reviewRepository.countForOwnerDashboard({ subjectType, subjectId, ...params }),
      reviewService.getSummary(subjectType, subjectId),
    ]);

    return {
      subjectType,
      subjectId,
      summary,
      reviews: rows,
      page: params.page,
      limit: params.limit,
      total,
      totalPages: Math.max(1, Math.ceil(total / params.limit)),
    };
  },
};
