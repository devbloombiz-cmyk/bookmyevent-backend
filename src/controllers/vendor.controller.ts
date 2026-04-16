import { vendorService } from "../services/vendor.service";
import { sendSuccess } from "../utils/api-response";
import { asyncHandler } from "../utils/async-handler";

export const vendorController = {
  createVendor: asyncHandler(async (req, res) => {
    const vendor = await vendorService.createVendor(req.body);
    return sendSuccess(res, "Vendor created", { vendor }, 201);
  }),
  listVendors: asyncHandler(async (req, res) => {
    const vendors = await vendorService.listVendors(req.query as Record<string, unknown>);
    return sendSuccess(res, "Vendors fetched", { vendors });
  }),
};
