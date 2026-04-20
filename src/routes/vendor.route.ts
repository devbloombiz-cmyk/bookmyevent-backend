import { Router } from "express";
import { vendorController } from "../controllers/vendor.controller";
import { requireAuth } from "../middlewares/auth.middleware";
import { requireRoles } from "../middlewares/roles.middleware";
import { validateRequest } from "../middlewares/validate-request.middleware";
import {
  vendorCreateSchema,
  vendorDeleteSchema,
  vendorListSchema,
  vendorSelfUpdateSchema,
  vendorUpdateSchema,
} from "../validators/vendor.validator";

const vendorRouter = Router();

vendorRouter.get("/", validateRequest(vendorListSchema), vendorController.listVendors);
vendorRouter.get(
  "/me",
  requireAuth,
  requireRoles(["vendor"]),
  vendorController.getMyVendorProfile,
);
vendorRouter.post(
  "/",
  requireAuth,
  requireRoles(["vendor", "vendor_admin", "accounts_admin", "super_admin"]),
  validateRequest(vendorCreateSchema),
  vendorController.createVendor,
);
vendorRouter.put(
  "/me",
  requireAuth,
  requireRoles(["vendor"]),
  validateRequest(vendorSelfUpdateSchema),
  vendorController.updateMyVendorProfile,
);
vendorRouter.put(
  "/:vendorId",
  requireAuth,
  requireRoles(["vendor_admin", "accounts_admin", "super_admin"]),
  validateRequest(vendorUpdateSchema),
  vendorController.updateVendor,
);
vendorRouter.delete(
  "/:vendorId",
  requireAuth,
  requireRoles(["vendor_admin", "accounts_admin", "super_admin"]),
  validateRequest(vendorDeleteSchema),
  vendorController.deleteVendor,
);

export { vendorRouter };
