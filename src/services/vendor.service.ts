import { vendorRepository } from "../repositories/vendor.repository";
import { galleryService } from "./gallery.service";

export const vendorService = {
  createVendor: async (payload: Record<string, unknown>) => {
    const vendor = await vendorRepository.create(payload);

    const portfolioImages = Array.isArray(payload.portfolioImages)
      ? payload.portfolioImages.filter((item): item is string => typeof item === "string" && item.trim().length > 0)
      : [];

    await galleryService.createVendorPortfolioGalleryItems({
      vendorId: String(vendor._id),
      vendorName: String(vendor.businessName ?? "Vendor"),
      category: String(vendor.category ?? "general"),
      subCategory: String(vendor.subCategory ?? ""),
      city: String(vendor.city ?? ""),
      mediaUrls: portfolioImages,
    });

    return vendor;
  },
  listVendors: (filters: Record<string, unknown>) => vendorRepository.findAll(filters),
};
