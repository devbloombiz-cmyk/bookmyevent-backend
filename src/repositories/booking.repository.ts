import { BookingModel } from "../models/booking.model";

export const bookingRepository = {
  create: (payload: Record<string, unknown>) => BookingModel.create(payload),
  findAll: () => BookingModel.find().sort({ createdAt: -1 }),
  findByCustomer: (customerId: string) => BookingModel.find({ customerId }).sort({ createdAt: -1 }),
  findByVendor: (vendorId: string) => BookingModel.find({ vendorId }).sort({ createdAt: -1 }),
  findById: (bookingId: string) => BookingModel.findById(bookingId),
  findByLeadId: (leadId: string) => BookingModel.findOne({ leadId }),
  updateById: (bookingId: string, payload: Record<string, unknown>) =>
    BookingModel.findByIdAndUpdate(bookingId, payload, { new: true }),
};
