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

    const bookings = await bookingService.listBookings(authUser, req.query as Record<string, unknown>);
    return sendSuccess(res, "Bookings fetched", { bookings });
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
};
