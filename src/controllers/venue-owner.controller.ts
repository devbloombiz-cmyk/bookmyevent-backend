import { PermissionKeys } from "../config/permissions";
import { venueOwnerService } from "../services/venue-owner.service";
import { sendSuccess } from "../utils/api-response";
import { asyncHandler } from "../utils/async-handler";

export const venueOwnerController = {
  createVenueOwner: asyncHandler(async (req, res) => {
    const isPrivilegedRequester = Boolean(
      req.authUser?.permissions?.includes(PermissionKeys.WorkspaceAdminAccess),
    );

    const venueOwner = await venueOwnerService.createVenueOwner(req.body, {
      requestedByRole: req.authUser?.role,
      isPrivilegedRequester,
    });
    return sendSuccess(res, "Venue owner created", { venueOwner }, 201);
  }),
  listVenueOwners: asyncHandler(async (req, res) => {
    const filters = { ...(req.query as Record<string, unknown>) };
    const isAdminUser = Boolean(
      req.authUser?.permissions?.includes(PermissionKeys.WorkspaceAdminAccess),
    );

    if (!isAdminUser) {
      filters.includeInactive = false;
    }

    const venueOwners = await venueOwnerService.listVenueOwners(filters);
    return sendSuccess(res, "Venue owners fetched", { venueOwners });
  }),
  getVenueOwnerById: asyncHandler(async (req, res) => {
    const venueOwnerId = String(req.params.venueOwnerId);
    const includeInactive = req.query.includeInactive === "true";
    const venueOwner = await venueOwnerService.getVenueOwnerById(venueOwnerId, includeInactive);
    return sendSuccess(res, "Venue owner fetched", { venueOwner });
  }),
  getMyVenueOwnerProfile: asyncHandler(async (req, res) => {
    const authUser = req.authUser;
    if (!authUser) {
      return sendSuccess(res, "Venue owner profile not found", { venueOwner: null });
    }

    const venueOwner = await venueOwnerService.getMyVenueOwnerProfile({ id: authUser.id });
    return sendSuccess(res, "Venue owner profile fetched", { venueOwner });
  }),
  updateMyVenueOwnerProfile: asyncHandler(async (req, res) => {
    const authUser = req.authUser;
    if (!authUser) {
      return sendSuccess(res, "Venue owner profile not found", { venueOwner: null });
    }

    const venueOwner = await venueOwnerService.updateMyVenueOwnerProfile(
      { id: authUser.id },
      req.body,
    );
    return sendSuccess(res, "Venue owner profile updated", { venueOwner });
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
