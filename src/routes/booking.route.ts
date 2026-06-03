import { Router } from "express";
import { PermissionKeys } from "../config/permissions";
import { bookingController } from "../controllers/booking.controller";
import { requireAuth } from "../middlewares/auth.middleware";
import { authorize } from "../middlewares/authorize.middleware";
import { validateRequest } from "../middlewares/validate-request.middleware";
import {
  bookingBalanceRequestSchema,
  bookingBalanceSendSchema,
  bookingCreateSchema,
  bookingPaymentRequestsListSchema,
  bookingPaymentReceiveSchema,
  bookingReferralAdminListSchema,
  bookingReferralVendorListSchema,
  bookingListSchema,
  bookingManualPaymentSchema,
  bookingUpdateSchema,
} from "../validators/booking.validator";

const bookingRouter = Router();

bookingRouter.get(
  "/",
  requireAuth,
  authorize([
    PermissionKeys.BookingReadOwnCustomer,
    PermissionKeys.BookingReadOwnVendor,
    PermissionKeys.BookingReadAny,
  ]),
  validateRequest(bookingListSchema),
  bookingController.listBookings,
);
bookingRouter.post(
  "/",
  requireAuth,
  validateRequest(bookingCreateSchema),
  bookingController.createBooking,
);
bookingRouter.get(
  "/referrals/me",
  requireAuth,
  authorize([PermissionKeys.BookingReadOwnVendor]),
  validateRequest(bookingReferralVendorListSchema),
  bookingController.listMyReferralBookings,
);
bookingRouter.get(
  "/referrals/admin",
  requireAuth,
  authorize([PermissionKeys.BookingReadAny]),
  validateRequest(bookingReferralAdminListSchema),
  bookingController.listAdminReferralInsights,
);
bookingRouter.put(
  "/:bookingId",
  requireAuth,
  authorize([PermissionKeys.BookingUpdateOwnVendor, PermissionKeys.BookingUpdateAny]),
  validateRequest(bookingUpdateSchema),
  bookingController.updateBooking,
);
bookingRouter.post(
  "/:bookingId/request-balance",
  requireAuth,
  authorize([PermissionKeys.BookingUpdateOwnVendor, PermissionKeys.BookingUpdateAny]),
  validateRequest(bookingBalanceRequestSchema),
  bookingController.requestBalancePayment,
);
bookingRouter.get(
  "/:bookingId/payment-requests",
  requireAuth,
  authorize([PermissionKeys.BookingReadOwnVendor, PermissionKeys.BookingReadAny]),
  validateRequest(bookingPaymentRequestsListSchema),
  bookingController.listBookingPaymentRequests,
);
bookingRouter.post(
  "/:bookingId/payment-requests/:paymentRequestId/send",
  requireAuth,
  authorize([PermissionKeys.BookingUpdateOwnVendor, PermissionKeys.BookingUpdateAny]),
  validateRequest(bookingBalanceSendSchema),
  bookingController.sendBalancePaymentLink,
);
bookingRouter.post(
  "/:bookingId/payment-requests/:paymentRequestId/mark-received",
  requireAuth,
  authorize([PermissionKeys.BookingUpdateOwnVendor, PermissionKeys.BookingUpdateAny]),
  validateRequest(bookingPaymentReceiveSchema),
  bookingController.markPaymentRequestReceived,
);
bookingRouter.post(
  "/:bookingId/manual-payment",
  requireAuth,
  authorize([PermissionKeys.BookingUpdateOwnVendor, PermissionKeys.BookingUpdateAny]),
  validateRequest(bookingManualPaymentSchema),
  bookingController.recordManualPayment,
);

export { bookingRouter };
