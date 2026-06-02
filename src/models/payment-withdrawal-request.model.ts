import { Schema, model } from "mongoose";

const WITHDRAWAL_REQUEST_STATUSES = ["PENDING", "APPROVED", "REJECTED", "TRANSFERRED"] as const;
const WITHDRAWAL_OWNER_TYPES = ["vendor", "venue_owner"] as const;

const withdrawalPaymentSelectionSchema = new Schema(
  {
    paymentRequestId: { type: Schema.Types.ObjectId, ref: "PaymentRequest", required: true },
    amount: { type: Number, required: true, min: 0 },
  },
  { _id: false },
);

const paymentWithdrawalRequestSchema = new Schema(
  {
    vendorId: { type: Schema.Types.ObjectId, ref: "Vendor", required: true },
    venueOwnerId: { type: Schema.Types.ObjectId, ref: "VenueOwner", default: null },
    requestedByUserId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    ownerType: { type: String, enum: WITHDRAWAL_OWNER_TYPES, required: true },
    status: {
      type: String,
      enum: WITHDRAWAL_REQUEST_STATUSES,
      default: "PENDING",
    },
    requestedAmount: { type: Number, required: true, min: 0 },
    paymentSelections: { type: [withdrawalPaymentSelectionSchema], default: [] },
    requestNote: { type: String, default: "", trim: true },
    adminNote: { type: String, default: "", trim: true },
    reviewedByUserId: { type: Schema.Types.ObjectId, ref: "User", default: null },
    reviewedAt: { type: Date, default: null },
    transferReference: { type: String, default: "", trim: true },
    transferredAt: { type: Date, default: null },
    transferredByUserId: { type: Schema.Types.ObjectId, ref: "User", default: null },
    metadata: { type: Schema.Types.Mixed, default: {} },
  },
  { timestamps: true },
);

paymentWithdrawalRequestSchema.index({ vendorId: 1, createdAt: -1 });
paymentWithdrawalRequestSchema.index({ venueOwnerId: 1, createdAt: -1 });
paymentWithdrawalRequestSchema.index({ status: 1, createdAt: -1 });

export const PaymentWithdrawalRequestModel = model(
  "PaymentWithdrawalRequest",
  paymentWithdrawalRequestSchema,
);
