import { reviewService } from "../services/review.service";
import { sendSuccess } from "../utils/api-response";
import { asyncHandler } from "../utils/async-handler";
import { ApiError } from "../utils/api-error";

export const reviewController = {
  createReview: asyncHandler(async (req, res) => {
    const authUser = req.authUser;
    if (!authUser) {
      throw new ApiError(401, "Unauthorized");
    }

    const review = await reviewService.createReview(req.body, authUser);
    return sendSuccess(res, "Review submitted", { review }, 201);
  }),

  getBookingReviewContext: asyncHandler(async (req, res) => {
    const authUser = req.authUser;
    if (!authUser) {
      throw new ApiError(401, "Unauthorized");
    }

    const bookingId = String(req.params.bookingId);
    const context = await reviewService.getBookingReviewContext(bookingId, authUser);
    return sendSuccess(res, "Review context fetched", { context });
  }),

  listPublicReviews: asyncHandler(async (req, res) => {
    const { subjectType, subjectId, page, limit, rating } = req.query as Record<string, string>;
    const reviews = await reviewService.listPublicReviews({
      subjectType: subjectType as "vendor" | "venue_owner",
      subjectId,
      page: Number(page),
      limit: Number(limit),
      rating: rating ? Number(rating) : undefined,
    });

    return sendSuccess(res, "Reviews fetched", reviews);
  }),

  getSummary: asyncHandler(async (req, res) => {
    const { subjectType, subjectId } = req.query as Record<string, string>;
    const summary = await reviewService.getSummary(subjectType as "vendor" | "venue_owner", subjectId);
    return sendSuccess(res, "Review summary fetched", { summary });
  }),

  listOwnerDashboardReviews: asyncHandler(async (req, res) => {
    const authUser = req.authUser;
    if (!authUser) {
      throw new ApiError(401, "Unauthorized");
    }

    const { page, limit, search, rating } = req.query as Record<string, string>;
    const data = await reviewService.listOwnerDashboardReviews(authUser, {
      page: Number(page),
      limit: Number(limit),
      search: search || undefined,
      rating: rating ? Number(rating) : undefined,
    });

    return sendSuccess(res, "Review dashboard fetched", data);
  }),
};
