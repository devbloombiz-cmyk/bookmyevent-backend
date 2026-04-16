import { Router } from "express";
import { locationController } from "../controllers/location.controller";
import { requireAuth } from "../middlewares/auth.middleware";
import { requireRoles } from "../middlewares/roles.middleware";
import { validateRequest } from "../middlewares/validate-request.middleware";
import { createLocationSchema, listLocationSchema } from "../validators/location.validator";

const locationRouter = Router();

locationRouter.get("/", validateRequest(listLocationSchema), locationController.listLocations);

locationRouter.post(
  "/",
  requireAuth,
  requireRoles(["super_admin", "vendor_admin", "accounts_admin"]),
  validateRequest(createLocationSchema),
  locationController.createLocation,
);

export { locationRouter };
