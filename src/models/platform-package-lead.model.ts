import { Schema, model } from "mongoose";

const platformPackageLeadSchema = new Schema(
  {
    packageId: { type: Schema.Types.ObjectId, ref: "PlatformPackage", required: true },
    packageTitle: { type: String, required: true, trim: true },
    name: { type: String, required: true, trim: true },
    mobile: { type: String, required: true, trim: true },
    email: { type: String, default: "", trim: true, lowercase: true },
    eventDate: { type: Date, default: null },
    message: { type: String, default: "", trim: true },
    status: {
      type: String,
      enum: ["new", "contacted", "closed"],
      default: "new",
    },
  },
  { timestamps: true },
);

platformPackageLeadSchema.index({ status: 1, createdAt: -1 });
platformPackageLeadSchema.index({ packageId: 1, createdAt: -1 });
platformPackageLeadSchema.index({ mobile: 1 });

export const PlatformPackageLeadModel = model("PlatformPackageLead", platformPackageLeadSchema);
