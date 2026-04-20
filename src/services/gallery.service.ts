import { galleryRepository } from "../repositories/gallery.repository";
import { ApiError } from "../utils/api-error";

export const galleryService = {
  createGalleryItem: (payload: Record<string, unknown>) => galleryRepository.create(payload),
  listGalleryItems: (filters: Record<string, unknown>) => galleryRepository.list(filters),
  updateGalleryItem: async (galleryId: string, payload: Record<string, unknown>) => {
    const galleryItem = await galleryRepository.updateById(galleryId, payload);
    if (!galleryItem) {
      throw new ApiError(404, "Gallery item not found");
    }
    return galleryItem;
  },
  deleteGalleryItem: async (galleryId: string) => {
    const galleryItem = await galleryRepository.deleteById(galleryId);
    if (!galleryItem) {
      throw new ApiError(404, "Gallery item not found");
    }
    return galleryItem;
  },
  createVendorPortfolioGalleryItems: async (payload: {
    vendorId: string;
    vendorName: string;
    category: string;
    subCategory: string;
    city: string;
    mediaUrls: string[];
  }) => {
    const galleryRows = payload.mediaUrls.map((mediaUrl) => ({
      title: `${payload.vendorName} portfolio`,
      category: payload.category,
      subCategory: payload.subCategory,
      mediaType: "image",
      mediaUrl,
      sourceType: "vendor",
      vendorId: payload.vendorId,
      location: payload.city,
      isFeatured: false,
      isActive: true,
    }));

    if (!galleryRows.length) {
      return [];
    }

    return galleryRepository.createMany(galleryRows);
  },
};
