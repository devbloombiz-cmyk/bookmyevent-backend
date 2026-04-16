import { availabilityService } from "../services/availability.service";
import { sendSuccess } from "../utils/api-response";
import { asyncHandler } from "../utils/async-handler";

export const availabilityController = {
  setAvailability: asyncHandler(async (req, res) => {
    const availability = await availabilityService.setAvailability(req.body);
    return sendSuccess(res, "Availability upserted", { availability });
  }),
  listByVendor: asyncHandler(async (req, res) => {
    const vendorId = String(req.query.vendorId ?? "");
    const slots = await availabilityService.listByVendor(vendorId);
    return sendSuccess(res, "Availability fetched", { slots });
  }),
};
