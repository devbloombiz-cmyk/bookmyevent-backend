import { Schema, model } from "mongoose";

const userRoleSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    roleId: { type: Schema.Types.ObjectId, ref: "Role", required: true, index: true },
  },
  { timestamps: true },
);

userRoleSchema.index({ userId: 1, roleId: 1 }, { unique: true });

export const UserRoleModel = model("UserRole", userRoleSchema);
