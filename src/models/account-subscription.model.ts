import { Schema, model } from "mongoose";

const accountSubscriptionSchema = new Schema(
  {
    actorType: { type: String, enum: ["vendor", "venue_owner"], required: true },
    actorId: { type: Schema.Types.ObjectId, required: true, index: true },
    planCode: { type: String, required: true, trim: true, index: true },
    status: {
      type: String,
      enum: ["inactive", "pending_payment", "active", "expired", "cancelled"],
      default: "inactive",
      index: true,
    },
    paymentStatus: {
      type: String,
      enum: ["pending", "confirmed", "failed"],
      default: "pending",
      index: true,
    },
    paymentProvider: {
      type: String,
      enum: ["manual", "razorpay"],
      default: "manual",
    },
    paymentReference: { type: String, default: "", trim: true },
    providerOrderId: { type: String, default: "", trim: true },
    providerPaymentId: { type: String, default: "", trim: true },
    providerSignature: { type: String, default: "", trim: true },
    amountInr: { type: Number, min: 0, default: 0 },
    startsAt: { type: Date, default: null },
    endsAt: { type: Date, default: null },
    confirmedAt: { type: Date, default: null },
    metadata: { type: Schema.Types.Mixed, default: {} },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
    updatedBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
  },
  { timestamps: true },
);

accountSubscriptionSchema.index({ actorType: 1, actorId: 1, createdAt: -1 });
accountSubscriptionSchema.index(
  { paymentReference: 1 },
  {
    unique: true,
    partialFilterExpression: { paymentReference: { $exists: true, $type: "string", $ne: "" } },
  },
);
accountSubscriptionSchema.index(
  { providerOrderId: 1 },
  {
    unique: true,
    partialFilterExpression: { providerOrderId: { $exists: true, $type: "string", $ne: "" } },
  },
);
accountSubscriptionSchema.index(
  { providerPaymentId: 1 },
  {
    unique: true,
    partialFilterExpression: { providerPaymentId: { $exists: true, $type: "string", $ne: "" } },
  },
);

export const AccountSubscriptionModel = model("AccountSubscription", accountSubscriptionSchema);
