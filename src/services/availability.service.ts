import { availabilityRepository } from "../repositories/availability.repository";

export const availabilityService = {
  setAvailability: (payload: { vendorId: string; date: Date; slot: string; status: string }) =>
    availabilityRepository.upsertSlot(payload),
  listByVendor: (vendorId: string) => availabilityRepository.findByVendor(vendorId),
};
