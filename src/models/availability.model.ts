import { Schema, model } from "mongoose";
import { AVAILABILITY_STATUSES } from "../types/domain";

const availabilitySchema = new Schema(
  {
    vendorId: { type: Schema.Types.ObjectId, ref: "Vendor", required: true },
    date: { type: Date, required: true },
    slot: { type: String, required: true, trim: true },
    status: { type: String, enum: AVAILABILITY_STATUSES, default: "available" },
  },
  { timestamps: true },
);

// Prevents duplicate slot entries for the same vendor and day.
availabilitySchema.index({ vendorId: 1, date: 1, slot: 1 }, { unique: true });

export const AvailabilityModel = model("Availability", availabilitySchema);
