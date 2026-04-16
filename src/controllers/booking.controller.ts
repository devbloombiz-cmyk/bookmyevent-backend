import { bookingService } from "../services/booking.service";
import { sendSuccess } from "../utils/api-response";
import { asyncHandler } from "../utils/async-handler";

export const bookingController = {
  createBooking: asyncHandler(async (req, res) => {
    const booking = await bookingService.createBooking(req.body);
    return sendSuccess(res, "Booking created", { booking }, 201);
  }),
  listBookings: asyncHandler(async (_req, res) => {
    const bookings = await bookingService.listBookings();
    return sendSuccess(res, "Bookings fetched", { bookings });
  }),
};
