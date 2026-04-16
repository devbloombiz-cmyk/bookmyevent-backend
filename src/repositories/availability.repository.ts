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
};
