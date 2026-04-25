import { PlatformPackageModel } from "../models/platform-package.model";
import { VendorPackageModel } from "../models/vendor-package.model";

export const packageRepository = {
  createVendorPackage: (payload: Record<string, unknown>) => VendorPackageModel.create(payload),
  listVendorPackages: (vendorId?: string, includeInactive = false) => {
    const query: Record<string, unknown> = {};

    if (vendorId) {
      query.vendorId = vendorId;
    }

    if (!includeInactive) {
      query.isActive = true;
    }

    return VendorPackageModel.find(query).sort({ createdAt: -1 });
  },
  createPlatformPackage: (payload: Record<string, unknown>) => PlatformPackageModel.create(payload),
  listPlatformPackages: (includeInactive = false) =>
    PlatformPackageModel.find(includeInactive ? {} : { isActive: true }).sort({ createdAt: -1 }),
  findPlatformPackageById: (packageId: string) => PlatformPackageModel.findById(packageId),
  updateVendorPackage: (packageId: string, payload: Record<string, unknown>) =>
    VendorPackageModel.findByIdAndUpdate(packageId, payload, { new: true }),
  findVendorPackageById: (packageId: string) => VendorPackageModel.findById(packageId),
  deleteVendorPackage: (packageId: string) => VendorPackageModel.findByIdAndDelete(packageId),
  updatePlatformPackage: (packageId: string, payload: Record<string, unknown>) =>
    PlatformPackageModel.findByIdAndUpdate(packageId, payload, { new: true }),
  deletePlatformPackage: (packageId: string) => PlatformPackageModel.findByIdAndDelete(packageId),
};
