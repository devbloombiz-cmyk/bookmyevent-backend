import { LocationModel } from "../models/location.model";

export const locationRepository = {
  findByState: (state: string, includeInactive = false) =>
    LocationModel.findOne(includeInactive ? { state } : { state, isActive: true }),
  create: (payload: Record<string, unknown>) => LocationModel.create(payload),
  save: (doc: InstanceType<typeof LocationModel>) => doc.save(),
  findAll: (includeInactive = false) =>
    LocationModel.find(includeInactive ? {} : { isActive: true }).sort({ state: 1 }).lean(),
  deleteById: (id: string) => LocationModel.findByIdAndDelete(id),
};
