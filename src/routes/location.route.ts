import { Router } from "express";
import { PermissionKeys } from "../config/permissions";
import { locationController } from "../controllers/location.controller";
import { requireAuth } from "../middlewares/auth.middleware";
import { authorize } from "../middlewares/authorize.middleware";
import { validateRequest } from "../middlewares/validate-request.middleware";
import { adminRateLimiter, publicReadLimiter } from "../middlewares/rate-limit.middleware";
import {
  createLocationSchema,
  deleteLocationEntrySchema,
  listLocationSchema,
  updateLocationEntrySchema,
} from "../validators/location.validator";

const locationRouter = Router();

locationRouter.get(
  "/",
  publicReadLimiter,
  validateRequest(listLocationSchema),
  locationController.listLocations,
);

locationRouter.post(
  "/",
  requireAuth,
  adminRateLimiter,
  authorize(PermissionKeys.LocationManage),
  validateRequest(createLocationSchema),
  locationController.createLocation,
);
locationRouter.put(
  "/entry",
  requireAuth,
  adminRateLimiter,
  authorize(PermissionKeys.LocationManage),
  validateRequest(updateLocationEntrySchema),
  locationController.updateLocationEntry,
);
locationRouter.delete(
  "/entry",
  requireAuth,
  adminRateLimiter,
  authorize(PermissionKeys.LocationManage),
  validateRequest(deleteLocationEntrySchema),
  locationController.deleteLocationEntry,
);

export { locationRouter };
