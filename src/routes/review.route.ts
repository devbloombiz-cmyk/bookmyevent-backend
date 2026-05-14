import { Router } from "express";
import { PermissionKeys } from "../config/permissions";
import { reviewController } from "../controllers/review.controller";
import { requireAuth } from "../middlewares/auth.middleware";
import { authorize } from "../middlewares/authorize.middleware";
import { reviewSubmissionRateLimit } from "../middlewares/review-rate-limit.middleware";
import { validateRequest } from "../middlewares/validate-request.middleware";
import {
  bookingReviewContextSchema,
  reviewCreateSchema,
  reviewOwnerDashboardSchema,
  reviewPublicListSchema,
  reviewSummarySchema,
} from "../validators/review.validator";

const reviewRouter = Router();

reviewRouter.get("/", validateRequest(reviewPublicListSchema), reviewController.listPublicReviews);
reviewRouter.get("/summary", validateRequest(reviewSummarySchema), reviewController.getSummary);

reviewRouter.get(
  "/booking/:bookingId",
  requireAuth,
  authorize(PermissionKeys.WorkspaceCustomerAccess),
  validateRequest(bookingReviewContextSchema),
  reviewController.getBookingReviewContext,
);

reviewRouter.post(
  "/",
  requireAuth,
  authorize(PermissionKeys.WorkspaceCustomerAccess),
  reviewSubmissionRateLimit,
  validateRequest(reviewCreateSchema),
  reviewController.createReview,
);

reviewRouter.get(
  "/owner/dashboard",
  requireAuth,
  authorize([PermissionKeys.WorkspaceVendorAccess, PermissionKeys.WorkspaceVenueOwnerAccess]),
  validateRequest(reviewOwnerDashboardSchema),
  reviewController.listOwnerDashboardReviews,
);

export { reviewRouter };
