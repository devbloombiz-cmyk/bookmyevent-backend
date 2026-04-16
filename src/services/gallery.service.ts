import { galleryRepository } from "../repositories/gallery.repository";

export const galleryService = {
  createGalleryItem: (payload: Record<string, unknown>) => galleryRepository.create(payload),
  listGalleryItems: (filters: Record<string, unknown>) => galleryRepository.list(filters),
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
