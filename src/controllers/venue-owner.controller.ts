import { venueOwnerService } from "../services/venue-owner.service";
import { sendSuccess } from "../utils/api-response";
import { asyncHandler } from "../utils/async-handler";

export const venueOwnerController = {
  createVenueOwner: asyncHandler(async (req, res) => {
    const venueOwner = await venueOwnerService.createVenueOwner(req.body, {
      requestedByRole: req.authUser?.role,
    });
    return sendSuccess(res, "Venue owner created", { venueOwner }, 201);
  }),
  listVenueOwners: asyncHandler(async (req, res) => {
    const venueOwners = await venueOwnerService.listVenueOwners(req.query as Record<string, unknown>);
    return sendSuccess(res, "Venue owners fetched", { venueOwners });
  }),
  getVenueOwnerById: asyncHandler(async (req, res) => {
    const venueOwnerId = String(req.params.venueOwnerId);
    const includeInactive = req.query.includeInactive === "true";
    const venueOwner = await venueOwnerService.getVenueOwnerById(venueOwnerId, includeInactive);
    return sendSuccess(res, "Venue owner fetched", { venueOwner });
  }),
  updateVenueOwner: asyncHandler(async (req, res) => {
    const venueOwnerId = String(req.params.venueOwnerId);
    const venueOwner = await venueOwnerService.updateVenueOwner(venueOwnerId, req.body);
    return sendSuccess(res, "Venue owner updated", { venueOwner });
  }),
  deleteVenueOwner: asyncHandler(async (req, res) => {
    const venueOwnerId = String(req.params.venueOwnerId);
    const venueOwner = await venueOwnerService.deleteVenueOwner(venueOwnerId);
    return sendSuccess(res, "Venue owner deleted", { venueOwner });
  }),
};
