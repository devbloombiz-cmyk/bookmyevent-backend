import { Router } from "express";
import { PermissionKeys } from "../config/permissions";
import { locationController } from "../controllers/location.controller";
import { requireAuth } from "../middlewares/auth.middleware";
import { authorize } from "../middlewares/authorize.middleware";
import { validateRequest } from "../middlewares/validate-request.middleware";
import {
  createLocationSchema,
  deleteLocationEntrySchema,
  listLocationSchema,
  updateLocationEntrySchema,
} from "../validators/location.validator";

const locationRouter = Router();

locationRouter.get("/", validateRequest(listLocationSchema), locationController.listLocations);

locationRouter.post(
  "/",
  requireAuth,
  authorize(PermissionKeys.LocationManage),
  validateRequest(createLocationSchema),
  locationController.createLocation,
);
locationRouter.put(
  "/entry",
  requireAuth,
  authorize(PermissionKeys.LocationManage),
  validateRequest(updateLocationEntrySchema),
  locationController.updateLocationEntry,
);
locationRouter.delete(
  "/entry",
  requireAuth,
  authorize(PermissionKeys.LocationManage),
  validateRequest(deleteLocationEntrySchema),
  locationController.deleteLocationEntry,
);

export { locationRouter };
