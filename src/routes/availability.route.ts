import { Router } from "express";
import { PermissionKeys } from "../config/permissions";
import { availabilityController } from "../controllers/availability.controller";
import { requireAuth } from "../middlewares/auth.middleware";
import { authorize } from "../middlewares/authorize.middleware";
import { validateRequest } from "../middlewares/validate-request.middleware";
import { listAvailabilitySchema, setAvailabilitySchema } from "../validators/availability.validator";

const availabilityRouter = Router();

availabilityRouter.get(
  "/",
  requireAuth,
  validateRequest(listAvailabilitySchema),
  availabilityController.listByVendor,
);
availabilityRouter.get(
  "/public",
  validateRequest(listAvailabilitySchema),
  availabilityController.listByVendorPublic,
);
availabilityRouter.post(
  "/",
  requireAuth,
  authorize([PermissionKeys.AvailabilityWriteOwn, PermissionKeys.AvailabilityWriteAny]),
  validateRequest(setAvailabilitySchema),
  availabilityController.setAvailability,
);

export { availabilityRouter };
