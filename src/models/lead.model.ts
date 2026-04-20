import { Schema, model } from "mongoose";
import { LEAD_STATUSES, PAYMENT_STATUSES } from "../types/domain";

const leadSchema = new Schema(
  {
    customerId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    vendorId: { type: Schema.Types.ObjectId, ref: "Vendor", required: true },
    eventDate: { type: Date, required: true },
    eventSlot: { type: String, default: "Full Day", trim: true },
    location: { type: String, required: true, trim: true },
    message: { type: String, default: "" },
    status: { type: String, enum: LEAD_STATUSES, default: "NEW" },
    quoteAmount: { type: Number, min: 0, default: 0 },
    paymentLink: { type: String, default: "" },
    paymentStatus: { type: String, enum: PAYMENT_STATUSES, default: "pending" },
  },
  { timestamps: true },
);

leadSchema.index({ vendorId: 1 });
leadSchema.index({ customerId: 1 });
leadSchema.index({ status: 1 });
leadSchema.index({ eventDate: 1 });

export const LeadModel = model("Lead", leadSchema);
