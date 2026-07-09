import { Router } from "express";
import { PermissionKeys } from "../config/permissions";
import { vendorController } from "../controllers/vendor.controller";
import { attachAuthIfPresent, requireAuth } from "../middlewares/auth.middleware";
import { authorize } from "../middlewares/authorize.middleware";
import { validateRequest } from "../middlewares/validate-request.middleware";
import {
  publicReadLimiter,
  searchLimiter,
  adminRateLimiter,
  authRateLimiter,
} from "../middlewares/rate-limit.middleware";
import {
  vendorAdminReferralVendorsSchema,
  vendorCreateSchema,
  vendorDeleteSchema,
  vendorListSchema,
  vendorMyReferralVendorsSchema,
  vendorReferralCodeValidationSchema,
  vendorSelfUpdateSchema,
  vendorUpdateSchema,
} from "../validators/vendor.validator";

const vendorRouter = Router();

vendorRouter.get(
  "/",
  attachAuthIfPresent,
  searchLimiter,
  validateRequest(vendorListSchema),
  vendorController.listVendors,
);
vendorRouter.get(
  "/me",
  requireAuth,
  adminRateLimiter,
  authorize([PermissionKeys.VendorUpdateOwn, PermissionKeys.VendorUpdateAny]),
  vendorController.getMyVendorProfile,
);
vendorRouter.get(
  "/referral-code/:code",
  publicReadLimiter,
  validateRequest(vendorReferralCodeValidationSchema),
  vendorController.validateReferralCode,
);
vendorRouter.get(
  "/referrals/me",
  requireAuth,
  adminRateLimiter,
  authorize([PermissionKeys.VendorRead, PermissionKeys.VendorUpdateOwn]),
  validateRequest(vendorMyReferralVendorsSchema),
  vendorController.listMyReferralVendors,
);
vendorRouter.get(
  "/referrals/admin",
  requireAuth,
  adminRateLimiter,
  authorize([PermissionKeys.WorkspaceAdminAccess, PermissionKeys.VendorRead]),
  validateRequest(vendorAdminReferralVendorsSchema),
  vendorController.listAdminReferralVendors,
);
vendorRouter.get(
  "/:vendorId",
  publicReadLimiter,
  validateRequest(vendorDeleteSchema),
  vendorController.getVendorById,
);
vendorRouter.post(
  "/",
  attachAuthIfPresent,
  authRateLimiter,
  validateRequest(vendorCreateSchema),
  vendorController.createVendor,
);
vendorRouter.put(
  "/me",
  requireAuth,
  adminRateLimiter,
  authorize([PermissionKeys.VendorUpdateOwn, PermissionKeys.VendorUpdateAny]),
  validateRequest(vendorSelfUpdateSchema),
  vendorController.updateMyVendorProfile,
);
vendorRouter.put(
  "/:vendorId",
  requireAuth,
  adminRateLimiter,
  authorize(PermissionKeys.VendorUpdateAny),
  validateRequest(vendorUpdateSchema),
  vendorController.updateVendor,
);
vendorRouter.delete(
  "/:vendorId",
  requireAuth,
  adminRateLimiter,
  authorize(PermissionKeys.VendorDeleteAny),
  validateRequest(vendorDeleteSchema),
  vendorController.deleteVendor,
);
export { vendorRouter };
