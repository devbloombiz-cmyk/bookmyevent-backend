import { PlatformPackageModel } from "../models/platform-package.model";
import { VendorPackageModel } from "../models/vendor-package.model";

export const packageRepository = {
  createVendorPackage: (payload: Record<string, unknown>) => VendorPackageModel.create(payload),
  listVendorPackages: (vendorId?: string) =>
    VendorPackageModel.find(vendorId ? { vendorId } : {}).sort({ createdAt: -1 }),
  createPlatformPackage: (payload: Record<string, unknown>) => PlatformPackageModel.create(payload),
  listPlatformPackages: () => PlatformPackageModel.find().sort({ createdAt: -1 }),
};
