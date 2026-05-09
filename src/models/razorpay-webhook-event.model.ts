import { Schema, model } from "mongoose";

const razorpayWebhookEventSchema = new Schema(
  {
    eventId: { type: String, required: true, trim: true, unique: true, index: true },
    eventType: { type: String, required: true, trim: true },
    payloadHash: { type: String, required: true, trim: true },
    receivedAt: { type: Date, required: true, default: Date.now },
  },
  { timestamps: true },
);

export const RazorpayWebhookEventModel = model(
  "RazorpayWebhookEvent",
  razorpayWebhookEventSchema,
);
