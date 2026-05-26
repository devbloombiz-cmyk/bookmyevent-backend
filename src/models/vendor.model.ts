import { Schema, model } from "mongoose";

const vendorSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", default: null },
    businessName: { type: String, required: true, trim: true },
    ownerName: { type: String, required: true, trim: true },
    email: { type: String, required: true, trim: true, lowercase: true },
    mobile: { type: String, required: true, trim: true },
    category: { type: String, required: true, trim: true },
    subCategory: { type: String, required: true, trim: true },
    subCategories: { type: [String], default: [] },
    state: { type: String, default: "", trim: true },
    district: { type: String, default: "", trim: true },
    city: { type: String, required: true, trim: true },
    locationDisplayName: { type: String, default: "", trim: true },
    locationInputMode: {
      type: String,
      enum: ["collection", "manual"],
      default: "collection",
    },
    serviceZones: { type: [String], default: [] },
    socialLinks: {
      facebook: { type: String, default: "", trim: true },
      instagram: { type: String, default: "", trim: true },
      youtube: { type: String, default: "", trim: true },
    },
    videoLinks: { type: [String], default: [] },
    websiteUrl: { type: String, default: "", trim: true },
    description: { type: String, default: "" },
    paymentTerms: { type: String, default: "", trim: true },
    travelCost: { type: String, default: "", trim: true },
    deliveryTime: { type: String, default: "", trim: true },
    profileType: {
      type: String,
      enum: ["vendor", "venue_owner_shadow"],
      default: "vendor",
    },
    pricingModel: {
      type: String,
      enum: ["base_package", "per_day", "per_plate"],
      default: "base_package",
    },
    pricingAmount: { type: Number, default: 0, min: 0 },
    registrationSource: { type: String, enum: ["admin", "public"], default: "public" },
    referralCode: { type: String, default: "", trim: true, uppercase: true },
    referralCodeAssignedAt: { type: Date, default: null },
    approvalStatus: {
      type: String,
      enum: ["pending", "active", "disabled"],
      default: "pending",
    },
    coverImage: { type: String, default: "", trim: true },
    portfolioImages: { type: [String], default: [] },
    rating: { type: Number, default: 0, min: 0, max: 5 },
    reviewCount: { type: Number, default: 0, min: 0 },
    isVerified: { type: Boolean, default: false },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true },
);

vendorSchema.index({ category: 1 });
vendorSchema.index({ userId: 1 }, { unique: true, sparse: true });
vendorSchema.index({ state: 1, district: 1, city: 1 });
vendorSchema.index({ city: 1 });
vendorSchema.index({ subCategory: 1 });
vendorSchema.index({ subCategories: 1 });
vendorSchema.index({ isVerified: 1 });
vendorSchema.index({ approvalStatus: 1, isActive: 1 });
vendorSchema.index({ registrationSource: 1 });
vendorSchema.index({ mobile: 1 });
vendorSchema.index({ email: 1 });
vendorSchema.index({ profileType: 1 });
vendorSchema.index({ category: 1, subCategory: 1, pricingModel: 1 });
vendorSchema.index({ referralCode: 1 }, { unique: true, sparse: true });

export const VendorModel = model("Vendor", vendorSchema);
