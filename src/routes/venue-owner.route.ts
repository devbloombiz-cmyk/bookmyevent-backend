import { Router } from "express";
import { PermissionKeys } from "../config/permissions";
import { venueOwnerController } from "../controllers/venue-owner.controller";
import { attachAuthIfPresent, requireAuth } from "../middlewares/auth.middleware";
import { authorize } from "../middlewares/authorize.middleware";
import { validateRequest } from "../middlewares/validate-request.middleware";
import {
  publicReadLimiter,
  searchLimiter,
  adminRateLimiter,
  authRateLimiter,
} from "../middlewares/rate-limit.middleware";
import {
  createVenueOwnerSchema,
  listVenueOwnerSchema,
  updateVenueOwnerSchema,
  updateVenueOwnerSelfSchema,
  venueOwnerIdSchema,
} from "../validators/venue-owner.validator";

const venueOwnerRouter = Router();

venueOwnerRouter.get(
  "/",
  attachAuthIfPresent,
  searchLimiter,
  validateRequest(listVenueOwnerSchema),
  venueOwnerController.listVenueOwners,
);
venueOwnerRouter.get(
  "/me",
  requireAuth,
  adminRateLimiter,
  authorize(PermissionKeys.WorkspaceVenueOwnerAccess),
  venueOwnerController.getMyVenueOwnerProfile,
);
venueOwnerRouter.get(
  "/:venueOwnerId",
  publicReadLimiter,
  validateRequest(venueOwnerIdSchema),
  venueOwnerController.getVenueOwnerById,
);
venueOwnerRouter.post(
  "/",
  attachAuthIfPresent,
  authRateLimiter,
  validateRequest(createVenueOwnerSchema),
  venueOwnerController.createVenueOwner,
);
venueOwnerRouter.put(
  "/me",
  requireAuth,
  adminRateLimiter,
  authorize(PermissionKeys.WorkspaceVenueOwnerAccess),
  validateRequest(updateVenueOwnerSelfSchema),
  venueOwnerController.updateMyVenueOwnerProfile,
);
venueOwnerRouter.put(
  "/:venueOwnerId",
  requireAuth,
  adminRateLimiter,
  authorize(PermissionKeys.VendorUpdateAny),
  validateRequest(updateVenueOwnerSchema),
  venueOwnerController.updateVenueOwner,
);
venueOwnerRouter.delete(
  "/:venueOwnerId",
  requireAuth,
  adminRateLimiter,
  authorize(PermissionKeys.VendorDeleteAny),
  validateRequest(venueOwnerIdSchema),
  venueOwnerController.deleteVenueOwner,
);

export { venueOwnerRouter };
