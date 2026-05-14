import { Schema, model } from "mongoose";

const activityTimelineSchema = new Schema(
  {
    entityType: { type: String, enum: ["lead", "booking", "payment_request"], required: true },
    entityId: { type: String, required: true, trim: true, index: true },
    vendorId: { type: Schema.Types.ObjectId, ref: "Vendor", default: null },
    actorUserId: { type: Schema.Types.ObjectId, ref: "User", default: null },
    event: { type: String, required: true, trim: true },
    message: { type: String, default: "", trim: true },
    metadata: { type: Schema.Types.Mixed, default: {} },
  },
  { timestamps: true },
);

activityTimelineSchema.index({ entityType: 1, entityId: 1, createdAt: -1 });

export const ActivityTimelineModel = model("ActivityTimeline", activityTimelineSchema);
