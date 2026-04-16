import { Schema, model } from "mongoose";

const vendorPackageSchema = new Schema(
  {
    vendorId: { type: Schema.Types.ObjectId, ref: "Vendor", required: true, index: true },
    title: { type: String, required: true, trim: true },
    description: { type: String, default: "" },
    price: { type: Number, required: true, min: 0 },
    inclusions: { type: [String], default: [] },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true },
);

vendorPackageSchema.index({ vendorId: 1, isActive: 1 });

export const VendorPackageModel = model("VendorPackage", vendorPackageSchema);
