import { Router } from "express";
import { PermissionKeys } from "../config/permissions";
import { reviewController } from "../controllers/review.controller";
import { requireAuth } from "../middlewares/auth.middleware";
import { authorize } from "../middlewares/authorize.middleware";
import { validateRequest } from "../middlewares/validate-request.middleware";
import {
  bookingReviewContextSchema,
  reviewCreateSchema,
  reviewDeleteSchema,
  reviewOwnerDashboardSchema,
  reviewPublicListSchema,
  reviewSummarySchema,
  reviewUpdateSchema,
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

reviewRouter.put(
  "/:reviewId",
  requireAuth,
  authorize(PermissionKeys.WorkspaceCustomerAccess),
  validateRequest(reviewUpdateSchema),
  reviewController.updateReview,
);

reviewRouter.delete(
  "/:reviewId",
  requireAuth,
  authorize([
    PermissionKeys.WorkspaceVendorAccess,
    PermissionKeys.WorkspaceVenueOwnerAccess,
    PermissionKeys.WorkspaceAdminAccess,
    PermissionKeys.WorkspaceCustomerAccess,
  ]),
  validateRequest(reviewDeleteSchema),
  reviewController.deleteReview,
);

export { reviewRouter };
