import mongoose from "mongoose";
import { GalleryModel } from "../models/gallery.model";

export const galleryRepository = {
  create: (payload: Record<string, unknown>) => GalleryModel.create(payload),
  createMany: (payload: Record<string, unknown>[]) => GalleryModel.insertMany(payload),
  list: (filters: Record<string, unknown> = {}) => {
    const query: Record<string, unknown> = {};

    if (filters.includeInactive !== true) {
      query.isActive = true;
    }

    if (typeof filters.category === "string" && filters.category.trim()) {
      query.category = filters.category.trim().toLowerCase();
    }

    if (typeof filters.vendorId === "string" && filters.vendorId.trim()) {
      const vendorIdStr = filters.vendorId.trim();
      if (mongoose.Types.ObjectId.isValid(vendorIdStr)) {
        query.vendorId = { $in: [vendorIdStr, new mongoose.Types.ObjectId(vendorIdStr)] };
      } else {
        query.vendorId = vendorIdStr;
      }
    }

    if (typeof filters.sourceType === "string" && filters.sourceType.trim()) {
      query.sourceType = filters.sourceType.trim();
    }

    const limit =
      typeof filters.limit === "number" ? Math.max(1, Math.min(120, filters.limit)) : 60;
    return GalleryModel.find(query).sort({ createdAt: -1 }).limit(limit);
  },
  findById: (galleryId: string) => GalleryModel.findById(galleryId),
  updateById: (galleryId: string, payload: Record<string, unknown>) =>
    GalleryModel.findByIdAndUpdate(galleryId, payload, { returnDocument: "after" }),
  deleteById: (galleryId: string) => GalleryModel.findByIdAndDelete(galleryId),
  deleteManyByVendorAndMediaType: (vendorId: string, mediaType: "image" | "video") => {
    const query: Record<string, unknown> = { sourceType: "vendor", mediaType };
    if (mongoose.Types.ObjectId.isValid(vendorId)) {
      query.vendorId = { $in: [vendorId, new mongoose.Types.ObjectId(vendorId)] };
    } else {
      query.vendorId = vendorId;
    }
    return GalleryModel.deleteMany(query);
  },
};
