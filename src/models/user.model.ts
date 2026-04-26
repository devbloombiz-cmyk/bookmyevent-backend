import { Schema, model } from "mongoose";
import { USER_ROLES } from "../types/domain";

const userSchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, trim: true, lowercase: true, default: undefined },
    mobile: { type: String, trim: true, default: undefined },
    passwordHash: { type: String, default: undefined },
    role: { type: String, enum: USER_ROLES, required: true, default: "customer" },
    isVerified: { type: Boolean, default: false },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true },
);

userSchema.index({ email: 1 }, { unique: true, sparse: true });
userSchema.index({ mobile: 1 }, { unique: true, sparse: true });
userSchema.index({ role: 1 });

export const UserModel = model("User", userSchema);
