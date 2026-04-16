import { packageRepository } from "../repositories/package.repository";

export const packageService = {
  createVendorPackage: (payload: Record<string, unknown>) => packageRepository.createVendorPackage(payload),
  listVendorPackages: (vendorId?: string) => packageRepository.listVendorPackages(vendorId),
  createPlatformPackage: (payload: Record<string, unknown>) =>
    packageRepository.createPlatformPackage(payload),
  listPlatformPackages: () => packageRepository.listPlatformPackages(),
};
