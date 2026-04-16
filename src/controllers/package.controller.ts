import { packageService } from "../services/package.service";
import { sendSuccess } from "../utils/api-response";
import { asyncHandler } from "../utils/async-handler";

export const packageController = {
  createVendorPackage: asyncHandler(async (req, res) => {
    const vendorPackage = await packageService.createVendorPackage(req.body);
    return sendSuccess(res, "Vendor package created", { vendorPackage }, 201);
  }),
  listVendorPackages: asyncHandler(async (req, res) => {
    const vendorId = typeof req.query.vendorId === "string" ? req.query.vendorId : undefined;
    const packages = await packageService.listVendorPackages(vendorId);
    return sendSuccess(res, "Vendor packages fetched", { packages });
  }),
  createPlatformPackage: asyncHandler(async (req, res) => {
    const platformPackage = await packageService.createPlatformPackage(req.body);
    return sendSuccess(res, "Platform package created", { platformPackage }, 201);
  }),
  listPlatformPackages: asyncHandler(async (_req, res) => {
    const packages = await packageService.listPlatformPackages();
    return sendSuccess(res, "Platform packages fetched", { packages });
  }),
};
