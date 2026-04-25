import { Schema, model } from "mongoose";

const locationSchema = new Schema(
  {
    state: { type: String, required: true, trim: true },
    districts: {
      type: [
        {
          name: { type: String, required: true, trim: true },
          cities: { type: [String], default: [] },
          imageUrl: { type: String, default: "", trim: true },
          isActive: { type: Boolean, default: true },
        },
      ],
      default: [],
    },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true },
);

locationSchema.index({ state: 1 }, { unique: true });

export const LocationModel = model("Location", locationSchema);
