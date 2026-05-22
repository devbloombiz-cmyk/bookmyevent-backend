import { Schema, model } from "mongoose";

const workspaceOperatorSchema = new Schema(
  {
    operatorUserId: { type: Schema.Types.ObjectId, ref: "User", required: true, unique: true },
    ownerType: { type: String, enum: ["vendor", "venue_owner"], required: true },
    vendorId: { type: Schema.Types.ObjectId, ref: "Vendor", default: null },
    venueOwnerId: { type: Schema.Types.ObjectId, ref: "VenueOwner", default: null },
    createdByUserId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true },
);

workspaceOperatorSchema.index({ ownerType: 1, vendorId: 1, createdAt: -1 });
workspaceOperatorSchema.index({ ownerType: 1, venueOwnerId: 1, createdAt: -1 });

export const WorkspaceOperatorModel = model("WorkspaceOperator", workspaceOperatorSchema);
