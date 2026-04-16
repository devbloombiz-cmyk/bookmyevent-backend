import { LocationModel } from "../models/location.model";

export const locationRepository = {
  findByState: (state: string) => LocationModel.findOne({ state, isActive: true }),
  create: (payload: Record<string, unknown>) => LocationModel.create(payload),
  save: (doc: InstanceType<typeof LocationModel>) => doc.save(),
  findAll: () => LocationModel.find({ isActive: true }).sort({ state: 1 }).lean(),
};
