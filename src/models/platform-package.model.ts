import { Schema, model } from "mongoose";

const platformPackageSchema = new Schema(
  {
    title: { type: String, required: true, trim: true },
    description: { type: String, default: "" },
    basePrice: { type: Number, required: true, min: 0 },
    category: { type: String, required: true, trim: true },
    inclusions: { type: [String], default: [] },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true },
);

platformPackageSchema.index({ category: 1, isActive: 1 });

export const PlatformPackageModel = model("PlatformPackage", platformPackageSchema);
