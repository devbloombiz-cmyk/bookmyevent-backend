import { GalleryModel } from "../models/gallery.model";

export const galleryRepository = {
  create: (payload: Record<string, unknown>) => GalleryModel.create(payload),
  createMany: (payload: Record<string, unknown>[]) => GalleryModel.insertMany(payload),
  list: (filters: Record<string, unknown> = {}) => {
    const query: Record<string, unknown> = { isActive: true };

    if (typeof filters.category === "string" && filters.category.trim()) {
      query.category = filters.category.trim().toLowerCase();
    }

    if (typeof filters.vendorId === "string" && filters.vendorId.trim()) {
      query.vendorId = filters.vendorId.trim();
    }

    if (typeof filters.sourceType === "string" && filters.sourceType.trim()) {
      query.sourceType = filters.sourceType.trim();
    }

    const limit = typeof filters.limit === "number" ? Math.max(1, Math.min(120, filters.limit)) : 60;
    return GalleryModel.find(query).sort({ createdAt: -1 }).limit(limit);
  },
};
