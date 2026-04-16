import { bookingRepository } from "../repositories/booking.repository";

export const bookingService = {
  createBooking: (payload: Record<string, unknown>) => bookingRepository.create(payload),
  listBookings: () => bookingRepository.findAll(),
};
