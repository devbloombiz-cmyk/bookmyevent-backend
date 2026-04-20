import { locationService } from "../services/location.service";
import { sendSuccess } from "../utils/api-response";
import { asyncHandler } from "../utils/async-handler";

export const locationController = {
  createLocation: asyncHandler(async (req, res) => {
    const location = await locationService.createLocation(req.body);
    return sendSuccess(res, "Location created", { location }, 201);
  }),
  listLocations: asyncHandler(async (req, res) => {
    const includeInactive = req.query.includeInactive === "true";
    const locations = await locationService.listLocations(includeInactive);
    return sendSuccess(res, "Locations fetched", { locations });
  }),
  updateLocationEntry: asyncHandler(async (req, res) => {
    const location = await locationService.updateLocationEntry(req.body);
    return sendSuccess(res, "Location updated", { location });
  }),
  deleteLocationEntry: asyncHandler(async (req, res) => {
    const location = await locationService.deleteLocationEntry(req.body);
    return sendSuccess(res, "Location deleted", { location });
  }),
};
