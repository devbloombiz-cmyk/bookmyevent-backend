import { Schema, model } from "mongoose";
import { BOOKING_STATUSES, PAYMENT_STATUSES, SETTLEMENT_STATUSES } from "../types/domain";

const bookingSchema = new Schema(
  {
    customerId: { type: Schema.Types.ObjectId, ref: "User", default: null },
    customerName: { type: String, default: "", trim: true },
    customerMobile: { type: String, default: "", trim: true },
    customerEmail: { type: String, default: "", trim: true },
    vendorId: { type: Schema.Types.ObjectId, ref: "Vendor", required: true },
    leadId: { type: Schema.Types.ObjectId, ref: "Lead", default: null },
    packageId: { type: Schema.Types.ObjectId, required: true },
    eventDate: { type: Date, required: true },
    eventSlot: { type: String, default: "Full Day", trim: true },
    amount: { type: Number, required: true, min: 0 },
    advancePaid: { type: Number, default: 0, min: 0 },
    paidAmount: { type: Number, default: 0, min: 0 },
    dueAmount: { type: Number, default: 0, min: 0 },
    paymentStatus: { type: String, enum: PAYMENT_STATUSES, default: "pending" },
    bookingStatus: { type: String, enum: BOOKING_STATUSES, default: "upcoming" },
    vendorAmount: { type: Number, default: 0, min: 0 },
    settledAmount: { type: Number, default: 0, min: 0 },
    pendingSettlement: { type: Number, default: 0, min: 0 },
    settlementStatus: { type: String, enum: SETTLEMENT_STATUSES, default: "PENDING" },
  },
  { timestamps: true },
);

bookingSchema.index({ customerId: 1 });
bookingSchema.index({ vendorId: 1 });
bookingSchema.index({ eventDate: 1 });
bookingSchema.index({ leadId: 1 });
bookingSchema.index({ settlementStatus: 1 });

export const BookingModel = model("Booking", bookingSchema);
