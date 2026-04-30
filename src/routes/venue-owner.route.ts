import { Router } from "express";
import { PermissionKeys } from "../config/permissions";
import { venueOwnerController } from "../controllers/venue-owner.controller";
import { attachAuthIfPresent, requireAuth } from "../middlewares/auth.middleware";
import { authorize } from "../middlewares/authorize.middleware";
import { validateRequest } from "../middlewares/validate-request.middleware";
import {
  createVenueOwnerSchema,
  listVenueOwnerSchema,
  updateVenueOwnerSchema,
  venueOwnerIdSchema,
} from "../validators/venue-owner.validator";

const venueOwnerRouter = Router();

venueOwnerRouter.get("/", validateRequest(listVenueOwnerSchema), venueOwnerController.listVenueOwners);
venueOwnerRouter.get(
  "/:venueOwnerId",
  validateRequest(venueOwnerIdSchema),
  venueOwnerController.getVenueOwnerById,
);
venueOwnerRouter.post(
  "/",
  attachAuthIfPresent,
  validateRequest(createVenueOwnerSchema),
  venueOwnerController.createVenueOwner,
);
venueOwnerRouter.put(
  "/:venueOwnerId",
  requireAuth,
  authorize(PermissionKeys.VendorUpdateAny),
  validateRequest(updateVenueOwnerSchema),
  venueOwnerController.updateVenueOwner,
);
venueOwnerRouter.delete(
  "/:venueOwnerId",
  requireAuth,
  authorize(PermissionKeys.VendorDeleteAny),
  validateRequest(venueOwnerIdSchema),
  venueOwnerController.deleteVenueOwner,
);

export { venueOwnerRouter };
