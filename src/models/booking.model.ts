import { Schema, model } from "mongoose";
import { BOOKING_STATUSES, PAYMENT_STATUSES } from "../types/domain";

const bookingSchema = new Schema(
  {
    customerId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    vendorId: { type: Schema.Types.ObjectId, ref: "Vendor", required: true },
    packageId: { type: Schema.Types.ObjectId, required: true },
    eventDate: { type: Date, required: true },
    amount: { type: Number, required: true, min: 0 },
    advancePaid: { type: Number, default: 0, min: 0 },
    paymentStatus: { type: String, enum: PAYMENT_STATUSES, default: "pending" },
    bookingStatus: { type: String, enum: BOOKING_STATUSES, default: "initiated" },
  },
  { timestamps: true },
);

bookingSchema.index({ customerId: 1 });
bookingSchema.index({ vendorId: 1 });
bookingSchema.index({ eventDate: 1 });

export const BookingModel = model("Booking", bookingSchema);
