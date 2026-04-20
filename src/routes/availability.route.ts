import { Router } from "express";
import { availabilityController } from "../controllers/availability.controller";
import { requireAuth } from "../middlewares/auth.middleware";
import { requireRoles } from "../middlewares/roles.middleware";
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
  requireRoles(["vendor", "vendor_admin", "super_admin"]),
  validateRequest(setAvailabilitySchema),
  availabilityController.setAvailability,
);

export { availabilityRouter };
