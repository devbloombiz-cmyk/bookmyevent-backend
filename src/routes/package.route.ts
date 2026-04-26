import { Router } from "express";
import { PermissionKeys } from "../config/permissions";
import { packageController } from "../controllers/package.controller";
import { requireAuth } from "../middlewares/auth.middleware";
import { authorize } from "../middlewares/authorize.middleware";
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
import { platformPackageLeadController } from "../controllers/platform-package-lead.controller";
import {
  createPlatformPackageLeadSchema,
  listPlatformPackageLeadSchema,
  updatePlatformPackageLeadSchema,
} from "../validators/platform-package-lead.validator";

const packageRouter = Router();

packageRouter.get("/vendor", validateRequest(listVendorPackageSchema), packageController.listVendorPackages);
packageRouter.get(
  "/platform",
  validateRequest(listPlatformPackageSchema),
  packageController.listPlatformPackages,
);
packageRouter.post(
  "/platform-leads",
  validateRequest(createPlatformPackageLeadSchema),
  platformPackageLeadController.createLead,
);
packageRouter.get(
  "/platform-leads",
  requireAuth,
  authorize(PermissionKeys.PackageLeadRead),
  validateRequest(listPlatformPackageLeadSchema),
  platformPackageLeadController.listLeads,
);
packageRouter.put(
  "/platform-leads/:leadId",
  requireAuth,
  authorize(PermissionKeys.PackageLeadUpdate),
  validateRequest(updatePlatformPackageLeadSchema),
  platformPackageLeadController.updateLead,
);

packageRouter.post(
  "/vendor",
  requireAuth,
  authorize([PermissionKeys.PackageVendorCreateOwn, PermissionKeys.PackageVendorCreateAny]),
  validateRequest(createVendorPackageSchema),
  packageController.createVendorPackage,
);
packageRouter.put(
  "/vendor/:packageId",
  requireAuth,
  authorize([PermissionKeys.PackageVendorUpdateOwn, PermissionKeys.PackageVendorUpdateAny]),
  validateRequest(updateVendorPackageSchema),
  packageController.updateVendorPackage,
);
packageRouter.delete(
  "/vendor/:packageId",
  requireAuth,
  authorize([PermissionKeys.PackageVendorDeleteOwn, PermissionKeys.PackageVendorDeleteAny]),
  validateRequest(deletePackageSchema),
  packageController.deleteVendorPackage,
);

packageRouter.post(
  "/platform",
  requireAuth,
  authorize(PermissionKeys.PackagePlatformManage),
  validateRequest(createPlatformPackageSchema),
  packageController.createPlatformPackage,
);
packageRouter.put(
  "/platform/:packageId",
  requireAuth,
  authorize(PermissionKeys.PackagePlatformManage),
  validateRequest(updatePlatformPackageSchema),
  packageController.updatePlatformPackage,
);
packageRouter.delete(
  "/platform/:packageId",
  requireAuth,
  authorize(PermissionKeys.PackagePlatformManage),
  validateRequest(deletePackageSchema),
  packageController.deletePlatformPackage,
);

export { packageRouter };
