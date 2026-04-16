import { BookingModel } from "../models/booking.model";

export const bookingRepository = {
  create: (payload: Record<string, unknown>) => BookingModel.create(payload),
  findAll: () => BookingModel.find().sort({ createdAt: -1 }),
};
