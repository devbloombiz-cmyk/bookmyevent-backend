import { Router } from "express";
import { packageController } from "../controllers/package.controller";
import { requireAuth } from "../middlewares/auth.middleware";
import { requireRoles } from "../middlewares/roles.middleware";
import { validateRequest } from "../middlewares/validate-request.middleware";
import {
  createPlatformPackageSchema,
  createVendorPackageSchema,
} from "../validators/package.validator";

const packageRouter = Router();

packageRouter.get("/vendor", packageController.listVendorPackages);
packageRouter.get("/platform", packageController.listPlatformPackages);

packageRouter.post(
  "/vendor",
  requireAuth,
  requireRoles(["vendor", "vendor_admin", "super_admin"]),
  validateRequest(createVendorPackageSchema),
  packageController.createVendorPackage,
);

packageRouter.post(
  "/platform",
  requireAuth,
  requireRoles(["super_admin", "accounts_admin", "vendor_admin"]),
  validateRequest(createPlatformPackageSchema),
  packageController.createPlatformPackage,
);

export { packageRouter };
