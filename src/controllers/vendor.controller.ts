import { vendorService } from "../services/vendor.service";
import { sendSuccess } from "../utils/api-response";
import { asyncHandler } from "../utils/async-handler";

export const vendorController = {
  createVendor: asyncHandler(async (req, res) => {
    const vendor = await vendorService.createVendor(req.body, {
      requestedByRole: req.authUser?.role,
    });
    return sendSuccess(res, "Vendor created", { vendor }, 201);
  }),
  listVendors: asyncHandler(async (req, res) => {
    const vendors = await vendorService.listVendors(req.query as Record<string, unknown>);
    return sendSuccess(res, "Vendors fetched", { vendors });
  }),
  getVendorById: asyncHandler(async (req, res) => {
    const vendorId = String(req.params.vendorId);
    const includeInactive = req.query.includeInactive === "true";
    const vendor = await vendorService.getVendorById(vendorId, includeInactive);
    return sendSuccess(res, "Vendor fetched", { vendor });
  }),
  getMyVendorProfile: asyncHandler(async (req, res) => {
    const authUser = req.authUser;
    if (!authUser) {
      return sendSuccess(res, "Vendor profile not found", { vendor: null });
    }

    const vendor = await vendorService.getMyVendorProfile({ id: authUser.id });
    return sendSuccess(res, "Vendor profile fetched", { vendor });
  }),
  updateMyVendorProfile: asyncHandler(async (req, res) => {
    const authUser = req.authUser;
    if (!authUser) {
      return sendSuccess(res, "Vendor profile not found", { vendor: null });
    }

    const vendor = await vendorService.updateMyVendorProfile(
      { id: authUser.id },
      req.body,
    );
    return sendSuccess(res, "Vendor profile updated", { vendor });
  }),
  updateVendor: asyncHandler(async (req, res) => {
    const vendorId = String(req.params.vendorId);
    const vendor = await vendorService.updateVendor(vendorId, req.body);
    return sendSuccess(res, "Vendor updated", { vendor });
  }),
  deleteVendor: asyncHandler(async (req, res) => {
    const vendorId = String(req.params.vendorId);
    const vendor = await vendorService.deleteVendor(vendorId);
    return sendSuccess(res, "Vendor deleted", { vendor });
  }),
};
