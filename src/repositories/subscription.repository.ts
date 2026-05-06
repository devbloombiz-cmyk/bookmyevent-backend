import { AccountSubscriptionModel } from "../models/account-subscription.model";
import { SubscriptionPlanModel } from "../models/subscription-plan.model";

type ActorType = "vendor" | "venue_owner";

export const subscriptionRepository = {
  upsertPlanByCode: (code: string, payload: Record<string, unknown>) =>
    SubscriptionPlanModel.findOneAndUpdate({ code }, { $set: payload }, { upsert: true, returnDocument: "after" }),
  getPlanByCode: (code: string) => SubscriptionPlanModel.findOne({ code }),
  listActivePlansByActorType: (actorType: ActorType) =>
    SubscriptionPlanModel.find({ isActive: true, actorTypes: actorType }).sort({ priceInr: 1 }),
  createAccountSubscription: (payload: Record<string, unknown>) => AccountSubscriptionModel.create(payload),
  findAccountSubscriptionById: (subscriptionId: string) => AccountSubscriptionModel.findById(subscriptionId),
  findLatestByActor: (actorType: ActorType, actorId: string) =>
    AccountSubscriptionModel.findOne({ actorType, actorId }).sort({ createdAt: -1 }),
  findByPaymentReference: (paymentReference: string) =>
    AccountSubscriptionModel.findOne({ paymentReference: paymentReference.trim() }),
  findByProviderPaymentId: (providerPaymentId: string) =>
    AccountSubscriptionModel.findOne({ providerPaymentId: providerPaymentId.trim() }),
  listSubscriptions: (filters: {
    status?: string;
    paymentStatus?: string;
    actorType?: ActorType;
    planCode?: string;
    limit?: number;
  }) => {
    const query: Record<string, unknown> = {};

    if (filters.status) {
      query.status = filters.status;
    }

    if (filters.paymentStatus) {
      query.paymentStatus = filters.paymentStatus;
    }

    if (filters.actorType) {
      query.actorType = filters.actorType;
    }

    if (filters.planCode) {
      query.planCode = filters.planCode;
    }

    const limit = typeof filters.limit === "number" ? Math.max(1, Math.min(300, filters.limit)) : 120;
    return AccountSubscriptionModel.find(query).sort({ createdAt: -1 }).limit(limit);
  },
  updateSubscriptionById: (subscriptionId: string, payload: Record<string, unknown>) =>
    AccountSubscriptionModel.findByIdAndUpdate(subscriptionId, payload, { returnDocument: "after" }),
};
