import { Schema, model } from "mongoose";

const vendorSchema = new Schema(
  {
    businessName: { type: String, required: true, trim: true },
    ownerName: { type: String, required: true, trim: true },
    email: { type: String, required: true, trim: true, lowercase: true },
    mobile: { type: String, required: true, trim: true },
    category: { type: String, required: true, trim: true },
    subCategory: { type: String, required: true, trim: true },
    state: { type: String, default: "", trim: true },
    district: { type: String, default: "", trim: true },
    city: { type: String, required: true, trim: true },
    serviceZones: { type: [String], default: [] },
    description: { type: String, default: "" },
    portfolioImages: { type: [String], default: [] },
    rating: { type: Number, default: 0, min: 0, max: 5 },
    reviewCount: { type: Number, default: 0, min: 0 },
    isVerified: { type: Boolean, default: false },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true },
);

vendorSchema.index({ category: 1 });
vendorSchema.index({ state: 1, district: 1, city: 1 });
vendorSchema.index({ city: 1 });
vendorSchema.index({ subCategory: 1 });
vendorSchema.index({ isVerified: 1 });

export const VendorModel = model("Vendor", vendorSchema);
