import { locationService } from "../services/location.service";
import { sendSuccess } from "../utils/api-response";
import { asyncHandler } from "../utils/async-handler";

export const locationController = {
  createLocation: asyncHandler(async (req, res) => {
    const location = await locationService.createLocation(req.body);
    return sendSuccess(res, "Location created", { location }, 201);
  }),
  listLocations: asyncHandler(async (_req, res) => {
    const locations = await locationService.listLocations();
    return sendSuccess(res, "Locations fetched", { locations });
  }),
};
