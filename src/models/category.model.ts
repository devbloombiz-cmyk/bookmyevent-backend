import { Schema, model } from "mongoose";

const categorySchema = new Schema(
  {
    name: { type: String, required: true, unique: true, trim: true, lowercase: true },
    displayName: { type: String, trim: true, default: "" },
    description: { type: String, trim: true, default: "" },
    icon: { type: String, trim: true, default: "" },
    coverImage: { type: String, trim: true, default: "" },
    isFeatured: { type: Boolean, default: false },
    subCategories: {
      type: [
        {
          name: { type: String, required: true, trim: true, lowercase: true },
          displayName: { type: String, trim: true, default: "" },
          image: { type: String, trim: true, default: "" },
          isActive: { type: Boolean, default: true },
        },
      ],
      default: [],
    },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true },
);
export const CategoryModel = model("Category", categorySchema);
