import { Router } from "express";
import { packageController } from "../controllers/package.controller";
import { requireAuth } from "../middlewares/auth.middleware";
import { requireRoles } from "../middlewares/roles.middleware";
import { validateRequest } from "../middlewares/validate-request.middleware";
import {
  createPlatformPackageSchema,
  createVendorPackageSchema,
  deletePackageSchema,
  listPlatformPackageSchema,
  listVendorPackageSchema,
  updatePlatformPackageSchema,
  updateVendorPackageSchema,
} from "../validators/package.validator";

const packageRouter = Router();

packageRouter.get("/vendor", validateRequest(listVendorPackageSchema), packageController.listVendorPackages);
packageRouter.get(
  "/platform",
  validateRequest(listPlatformPackageSchema),
  packageController.listPlatformPackages,
);

packageRouter.post(
  "/vendor",
  requireAuth,
  requireRoles(["vendor", "vendor_admin", "super_admin"]),
  validateRequest(createVendorPackageSchema),
  packageController.createVendorPackage,
);
packageRouter.put(
  "/vendor/:packageId",
  requireAuth,
  requireRoles(["vendor", "vendor_admin", "super_admin"]),
  validateRequest(updateVendorPackageSchema),
  packageController.updateVendorPackage,
);
packageRouter.delete(
  "/vendor/:packageId",
  requireAuth,
  requireRoles(["vendor", "vendor_admin", "super_admin"]),
  validateRequest(deletePackageSchema),
  packageController.deleteVendorPackage,
);

packageRouter.post(
  "/platform",
  requireAuth,
  requireRoles(["super_admin", "accounts_admin", "vendor_admin"]),
  validateRequest(createPlatformPackageSchema),
  packageController.createPlatformPackage,
);
packageRouter.put(
  "/platform/:packageId",
  requireAuth,
  requireRoles(["super_admin", "accounts_admin", "vendor_admin"]),
  validateRequest(updatePlatformPackageSchema),
  packageController.updatePlatformPackage,
);
packageRouter.delete(
  "/platform/:packageId",
  requireAuth,
  requireRoles(["super_admin", "accounts_admin", "vendor_admin"]),
  validateRequest(deletePackageSchema),
  packageController.deletePlatformPackage,
);

export { packageRouter };
