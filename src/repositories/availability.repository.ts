import { AvailabilityModel } from "../models/availability.model";

export const availabilityRepository = {
  create: (payload: Record<string, unknown>) => AvailabilityModel.create(payload),
  upsertSlot: (payload: { vendorId: string; date: Date; slot: string; status: string }) =>
    AvailabilityModel.findOneAndUpdate(
      { vendorId: payload.vendorId, date: payload.date, slot: payload.slot },
      { $set: payload },
      { returnDocument: "after", upsert: true },
    ),
  findByVendor: (vendorId: string) => AvailabilityModel.find({ vendorId }).sort({ date: 1 }),
  findByVendorAndDate: (vendorId: string, date: Date) =>
    AvailabilityModel.find({ vendorId, date }).sort({ slot: 1 }),
  listAvailableVendorIdsByDate: async (date: Date) => {
    const start = new Date(date);
    start.setHours(0, 0, 0, 0);

    const end = new Date(date);
    end.setHours(23, 59, 59, 999);

    return AvailabilityModel.distinct("vendorId", {
      date: { $gte: start, $lte: end },
      status: { $in: ["available", "tentative"] },
    });
  },
  updateById: (id: string, payload: Record<string, unknown>) =>
    AvailabilityModel.findByIdAndUpdate(id, payload, { returnDocument: "after" }),
};
