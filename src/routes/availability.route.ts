import { Router } from "express";
import { availabilityController } from "../controllers/availability.controller";
import { requireAuth } from "../middlewares/auth.middleware";
import { requireRoles } from "../middlewares/roles.middleware";
import { validateRequest } from "../middlewares/validate-request.middleware";
import { setAvailabilitySchema } from "../validators/availability.validator";

const availabilityRouter = Router();

availabilityRouter.get("/", requireAuth, availabilityController.listByVendor);
availabilityRouter.get("/public", availabilityController.listByVendor);
availabilityRouter.post(
  "/",
  requireAuth,
  requireRoles(["vendor", "vendor_admin", "super_admin"]),
  validateRequest(setAvailabilitySchema),
  availabilityController.setAvailability,
);

export { availabilityRouter };
