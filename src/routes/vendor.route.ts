import { Router } from "express";
import { PermissionKeys } from "../config/permissions";
import { vendorController } from "../controllers/vendor.controller";
import { requireAuth } from "../middlewares/auth.middleware";
import { authorize } from "../middlewares/authorize.middleware";
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
  authorize([PermissionKeys.VendorUpdateOwn, PermissionKeys.VendorUpdateAny]),
  vendorController.getMyVendorProfile,
);
vendorRouter.get(
  "/:vendorId",
  validateRequest(vendorDeleteSchema),
  vendorController.getVendorById,
);
vendorRouter.post(
  "/",
  validateRequest(vendorCreateSchema),
  vendorController.createVendor,
);
vendorRouter.put(
  "/me",
  requireAuth,
  authorize([PermissionKeys.VendorUpdateOwn, PermissionKeys.VendorUpdateAny]),
  validateRequest(vendorSelfUpdateSchema),
  vendorController.updateMyVendorProfile,
);
vendorRouter.put(
  "/:vendorId",
  requireAuth,
  authorize(PermissionKeys.VendorUpdateAny),
  validateRequest(vendorUpdateSchema),
  vendorController.updateVendor,
);
vendorRouter.delete(
  "/:vendorId",
  requireAuth,
  authorize(PermissionKeys.VendorDeleteAny),
  validateRequest(vendorDeleteSchema),
  vendorController.deleteVendor,
);

export { vendorRouter };
