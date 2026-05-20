import { Schema, model } from "mongoose";

const vendorPackageSchema = new Schema(
  {
    vendorId: { type: Schema.Types.ObjectId, ref: "Vendor", required: true, index: true },
    ownerType: {
      type: String,
      enum: ["vendor", "venue_owner"],
      default: "vendor",
      index: true,
    },
    venueOwnerId: { type: Schema.Types.ObjectId, ref: "VenueOwner", default: null, index: true },
    title: { type: String, required: true, trim: true },
    description: { type: String, default: "" },
    price: { type: Number, required: true, min: 0 },
    duration: { type: String, default: "" },
    inclusions: { type: [String], default: [] },
    features: { type: [String], default: [] },
    coverImage: { type: String, default: "" },
    portfolioImages: { type: [String], default: [] },
    videoLinks: { type: [String], default: [] },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true },
);

vendorPackageSchema.index({ vendorId: 1, isActive: 1 });
vendorPackageSchema.index({ vendorId: 1, ownerType: 1, venueOwnerId: 1, isActive: 1 });

export const VendorPackageModel = model("VendorPackage", vendorPackageSchema);
