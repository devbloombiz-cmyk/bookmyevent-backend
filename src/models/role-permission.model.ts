import { Schema, model } from "mongoose";

const rolePermissionSchema = new Schema(
  {
    roleId: { type: Schema.Types.ObjectId, ref: "Role", required: true, index: true },
    permissionId: { type: Schema.Types.ObjectId, ref: "Permission", required: true, index: true },
  },
  { timestamps: true },
);

rolePermissionSchema.index({ roleId: 1, permissionId: 1 }, { unique: true });

export const RolePermissionModel = model("RolePermission", rolePermissionSchema);
