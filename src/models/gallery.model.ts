import { Schema, model } from "mongoose";

const gallerySchema = new Schema(
  {
    title: { type: String, required: true, trim: true },
    category: { type: String, required: true, trim: true, lowercase: true },
    subCategory: { type: String, default: "", trim: true, lowercase: true },
    mediaType: { type: String, enum: ["image", "video"], default: "image" },
    mediaUrl: { type: String, required: true, trim: true },
    thumbnailUrl: { type: String, default: "", trim: true },
    sourceType: { type: String, enum: ["admin", "vendor"], default: "vendor" },
    vendorId: { type: String, default: "", trim: true },
    location: { type: String, default: "", trim: true },
    isFeatured: { type: Boolean, default: false },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true },
);

gallerySchema.index({ category: 1, isActive: 1 });
gallerySchema.index({ sourceType: 1 });
gallerySchema.index({ vendorId: 1 });

export const GalleryModel = model("Gallery", gallerySchema);
