import { Schema, model } from "mongoose";
import { PAYMENT_REQUEST_TYPES, PAYMENT_STATUSES } from "../types/domain";

const paymentRequestSchema = new Schema(
  {
    leadId: { type: Schema.Types.ObjectId, ref: "Lead", default: null },
    bookingId: { type: Schema.Types.ObjectId, ref: "Booking", default: null },
    vendorId: { type: Schema.Types.ObjectId, ref: "Vendor", required: true },
    customerId: { type: Schema.Types.ObjectId, ref: "User", default: null },
    packageId: { type: Schema.Types.ObjectId, default: null },
    packageName: { type: String, default: "", trim: true },
    paymentType: { type: String, enum: PAYMENT_REQUEST_TYPES, required: true },
    status: { type: String, enum: PAYMENT_STATUSES, default: "pending" },
    finalAmount: { type: Number, required: true, min: 0 },
    requestedAmount: { type: Number, required: true, min: 0 },
    paidAmount: { type: Number, default: 0, min: 0 },
    notes: { type: String, default: "", trim: true },
    paymentExpiry: { type: Date, default: null },
    razorpayPaymentLinkId: { type: String, trim: true },
    razorpayPaymentId: { type: String, trim: true },
    razorpayReferenceId: { type: String, trim: true },
    paymentLinkUrl: { type: String, trim: true },
    webhookEventId: { type: String, trim: true },
    sentToWhatsapp: { type: Boolean, default: false },
    metadata: { type: Schema.Types.Mixed, default: {} },
  },
  { timestamps: true },
);

paymentRequestSchema.index({ leadId: 1, createdAt: -1 });
paymentRequestSchema.index({ bookingId: 1, createdAt: -1 });
paymentRequestSchema.index({ vendorId: 1, createdAt: -1 });
paymentRequestSchema.index({ status: 1 });
paymentRequestSchema.index(
  { razorpayPaymentLinkId: 1 },
  {
    unique: true,
    partialFilterExpression: { razorpayPaymentLinkId: { $exists: true, $type: "string", $ne: "" } },
  },
);
paymentRequestSchema.index(
  { razorpayPaymentId: 1 },
  {
    unique: true,
    partialFilterExpression: { razorpayPaymentId: { $exists: true, $type: "string", $ne: "" } },
  },
);
paymentRequestSchema.index(
  { razorpayReferenceId: 1 },
  {
    unique: true,
    partialFilterExpression: { razorpayReferenceId: { $exists: true, $type: "string", $ne: "" } },
  },
);

export const PaymentRequestModel = model("PaymentRequest", paymentRequestSchema);
