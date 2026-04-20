import { packageService } from "../services/package.service";
import { sendSuccess } from "../utils/api-response";
import { asyncHandler } from "../utils/async-handler";

export const packageController = {
  createVendorPackage: asyncHandler(async (req, res) => {
    const authUser = req.authUser;
    if (!authUser) {
      return sendSuccess(res, "Unauthorized", { vendorPackage: null }, 401);
    }

    const vendorPackage = await packageService.createVendorPackage(req.body, authUser);
    return sendSuccess(res, "Vendor package created", { vendorPackage }, 201);
  }),
  listVendorPackages: asyncHandler(async (req, res) => {
    const vendorId = typeof req.query.vendorId === "string" ? req.query.vendorId : undefined;
    const includeInactive = req.query.includeInactive === "true";
    const packages = await packageService.listVendorPackages(vendorId, includeInactive, req.authUser);
    return sendSuccess(res, "Vendor packages fetched", { packages });
  }),
  updateVendorPackage: asyncHandler(async (req, res) => {
    const authUser = req.authUser;
    if (!authUser) {
      return sendSuccess(res, "Unauthorized", { vendorPackage: null }, 401);
    }

    const packageId = String(req.params.packageId);
    const vendorPackage = await packageService.updateVendorPackage(packageId, req.body, authUser);
    return sendSuccess(res, "Vendor package updated", { vendorPackage });
  }),
  deleteVendorPackage: asyncHandler(async (req, res) => {
    const authUser = req.authUser;
    if (!authUser) {
      return sendSuccess(res, "Unauthorized", { vendorPackage: null }, 401);
    }

    const packageId = String(req.params.packageId);
    const vendorPackage = await packageService.deleteVendorPackage(packageId, authUser);
    return sendSuccess(res, "Vendor package deleted", { vendorPackage });
  }),
  createPlatformPackage: asyncHandler(async (req, res) => {
    const platformPackage = await packageService.createPlatformPackage(req.body);
    return sendSuccess(res, "Platform package created", { platformPackage }, 201);
  }),
  listPlatformPackages: asyncHandler(async (req, res) => {
    const includeInactive = req.query.includeInactive === "true";
    const packages = await packageService.listPlatformPackages(includeInactive);
    return sendSuccess(res, "Platform packages fetched", { packages });
  }),
  updatePlatformPackage: asyncHandler(async (req, res) => {
    const packageId = String(req.params.packageId);
    const platformPackage = await packageService.updatePlatformPackage(packageId, req.body);
    return sendSuccess(res, "Platform package updated", { platformPackage });
  }),
  deletePlatformPackage: asyncHandler(async (req, res) => {
    const packageId = String(req.params.packageId);
    const platformPackage = await packageService.deletePlatformPackage(packageId);
    return sendSuccess(res, "Platform package deleted", { platformPackage });
  }),
};
