import { bookingService } from "../services/booking.service";
import { sendSuccess } from "../utils/api-response";
import { asyncHandler } from "../utils/async-handler";
import { ApiError } from "../utils/api-error";

export const bookingController = {
  createBooking: asyncHandler(async (req, res) => {
    const authUser = req.authUser;
    if (!authUser) {
      throw new ApiError(401, "Unauthorized");
    }

    const booking = await bookingService.createBooking(req.body, authUser);
    return sendSuccess(res, "Booking created", { booking }, 201);
  }),
  listBookings: asyncHandler(async (req, res) => {
    const authUser = req.authUser;
    if (!authUser) {
      throw new ApiError(401, "Unauthorized");
    }

    const bookings = await bookingService.listBookings(
      authUser,
      req.query as Record<string, unknown>,
    );
    return sendSuccess(res, "Bookings fetched", { bookings });
  }),
  listMyReferralBookings: asyncHandler(async (req, res) => {
    const authUser = req.authUser;
    if (!authUser) {
      throw new ApiError(401, "Unauthorized");
    }

    const referralData = await bookingService.listMyReferralBookings(authUser);
    return sendSuccess(res, "Referral bookings fetched", referralData);
  }),
  listAdminReferralInsights: asyncHandler(async (req, res) => {
    const authUser = req.authUser;
    if (!authUser) {
      throw new ApiError(401, "Unauthorized");
    }

    const limit = Number(req.query.limit || 100);
    const referralData = await bookingService.listAdminReferralInsights(limit);
    return sendSuccess(res, "Referral insights fetched", referralData);
  }),
  updateBooking: asyncHandler(async (req, res) => {
    const authUser = req.authUser;
    if (!authUser) {
      throw new ApiError(401, "Unauthorized");
    }

    const bookingId = String(req.params.bookingId);
    const booking = await bookingService.updateBooking(bookingId, req.body, authUser);
    return sendSuccess(res, "Booking updated", { booking });
  }),
  requestBalancePayment: asyncHandler(async (req, res) => {
    const authUser = req.authUser;
    if (!authUser) {
      throw new ApiError(401, "Unauthorized");
    }

    const bookingId = String(req.params.bookingId);
    const paymentRequest = await bookingService.requestBalancePayment(
      bookingId,
      req.body,
      authUser,
    );
    return sendSuccess(res, "Balance payment request created", { paymentRequest }, 201);
  }),
  sendBalancePaymentLink: asyncHandler(async (req, res) => {
    const authUser = req.authUser;
    if (!authUser) {
      throw new ApiError(401, "Unauthorized");
    }

    const bookingId = String(req.params.bookingId);
    const paymentRequestId = String(req.params.paymentRequestId);
    const paymentRequest = await bookingService.sendBalancePaymentLinkToCustomer(
      bookingId,
      paymentRequestId,
      req.body,
      authUser,
    );
    return sendSuccess(res, "Balance payment link sent to customer", { paymentRequest });
  }),
  recordManualPayment: asyncHandler(async (req, res) => {
    const authUser = req.authUser;
    if (!authUser) {
      throw new ApiError(401, "Unauthorized");
    }

    const bookingId = String(req.params.bookingId);
    const result = await bookingService.recordManualPayment(bookingId, req.body, authUser);
    return sendSuccess(res, "Manual payment recorded", result, 201);
  }),
};
