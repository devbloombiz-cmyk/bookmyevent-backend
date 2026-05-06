import { Schema, model } from "mongoose";

const subscriptionPlanSchema = new Schema(
  {
    code: { type: String, required: true, trim: true, unique: true },
    actorTypes: {
      type: [String],
      default: ["vendor", "venue_owner"],
      enum: ["vendor", "venue_owner"],
    },
    name: { type: String, required: true, trim: true },
    description: { type: String, default: "", trim: true },
    priceInr: { type: Number, required: true, min: 0, default: 0 },
    billingCycle: {
      type: String,
      enum: ["yearly", "monthly", "one_time"],
      default: "yearly",
    },
    limits: {
      maxPortfolioImages: { type: Number, min: -1, default: 0 },
      maxVideoLinks: { type: Number, min: -1, default: 0 },
      maxPackages: { type: Number, min: -1, default: 3 },
    },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true },
);

subscriptionPlanSchema.index({ code: 1 }, { unique: true });
subscriptionPlanSchema.index({ isActive: 1 });

export const SubscriptionPlanModel = model("SubscriptionPlan", subscriptionPlanSchema);
