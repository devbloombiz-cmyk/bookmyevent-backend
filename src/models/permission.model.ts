import { Schema, model } from "mongoose";

const permissionSchema = new Schema(
  {
    key: { type: String, required: true, unique: true, trim: true, index: true },
    description: { type: String, required: true, trim: true },
    isSystem: { type: Boolean, default: true },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true },
);

export const PermissionModel = model("Permission", permissionSchema);
