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
bookingRouter.post(
  "/:bookingId/payment-requests/:paymentRequestId/send",
  requireAuth,
  authorize([PermissionKeys.BookingUpdateOwnVendor, PermissionKeys.BookingUpdateAny]),
  validateRequest(bookingBalanceSendSchema),
  bookingController.sendBalancePaymentLink,
);
bookingRouter.post(
  "/:bookingId/manual-payment",
  requireAuth,
  authorize([PermissionKeys.BookingUpdateOwnVendor, PermissionKeys.BookingUpdateAny]),
  validateRequest(bookingManualPaymentSchema),
  bookingController.recordManualPayment,
);

export { bookingRouter };
