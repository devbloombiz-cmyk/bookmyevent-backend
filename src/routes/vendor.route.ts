import { Router } from "express";
import { vendorController } from "../controllers/vendor.controller";
import { requireAuth } from "../middlewares/auth.middleware";
import { requireRoles } from "../middlewares/roles.middleware";
import { validateRequest } from "../middlewares/validate-request.middleware";
import { vendorCreateSchema, vendorListSchema } from "../validators/vendor.validator";

const vendorRouter = Router();

vendorRouter.get("/", validateRequest(vendorListSchema), vendorController.listVendors);
vendorRouter.post(
  "/",
  requireAuth,
  requireRoles(["vendor", "vendor_admin", "accounts_admin", "super_admin"]),
  validateRequest(vendorCreateSchema),
  vendorController.createVendor,
);

export { vendorRouter };
