import { AvailabilityModel } from "../models/availability.model";

export const availabilityRepository = {
  create: (payload: Record<string, unknown>) => AvailabilityModel.create(payload),
  upsertSlot: (payload: { vendorId: string; date: Date; slot: string; status: string }) =>
    AvailabilityModel.findOneAndUpdate(
      { vendorId: payload.vendorId, date: payload.date, slot: payload.slot },
      { $set: payload },
      { new: true, upsert: true },
    ),
  findByVendor: (vendorId: string) => AvailabilityModel.find({ vendorId }).sort({ date: 1 }),
  findByVendorAndDate: (vendorId: string, date: Date) =>
    AvailabilityModel.find({ vendorId, date }).sort({ slot: 1 }),
  updateById: (id: string, payload: Record<string, unknown>) =>
    AvailabilityModel.findByIdAndUpdate(id, payload, { new: true }),
};
