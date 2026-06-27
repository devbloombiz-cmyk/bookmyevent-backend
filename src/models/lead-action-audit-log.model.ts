import { Schema, model } from "mongoose";

const leadActionAuditLogSchema = new Schema(
  {
    vendorId: { type: Schema.Types.ObjectId, ref: "Vendor", default: null },
    leadId: { type: Schema.Types.ObjectId, ref: "Lead", default: null },
    venueOwnerId: { type: Schema.Types.ObjectId, ref: "VenueOwner", default: null },
    action: { type: String, required: true, trim: true },
    ipAddress: { type: String, default: "" },
    userAgent: { type: String, default: "" },
    status: { type: String, enum: ["SUCCESS", "FAILURE"], required: true },
    reason: { type: String, default: "" },
    timestamp: { type: Date, default: Date.now },
  },
  { timestamps: true },
);

leadActionAuditLogSchema.index({ leadId: 1, timestamp: -1 });

export const LeadActionAuditLogModel = model("LeadActionAuditLog", leadActionAuditLogSchema);
