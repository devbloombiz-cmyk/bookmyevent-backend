import { AccountSubscriptionModel } from "../models/account-subscription.model";
import { RazorpayWebhookEventModel } from "../models/razorpay-webhook-event.model";
import { SubscriptionPlanModel } from "../models/subscription-plan.model";
import type { ClientSession } from "mongoose";

type ActorType = "vendor" | "venue_owner";

export const subscriptionRepository = {
  upsertPlanByCode: (code: string, payload: Record<string, unknown>) =>
    SubscriptionPlanModel.findOneAndUpdate(
      { code },
      { $set: payload },
      { upsert: true, returnDocument: "after" },
    ),
  createPlan: (payload: Record<string, unknown>) => SubscriptionPlanModel.create(payload),
  getPlanByCode: (code: string) => SubscriptionPlanModel.findOne({ code }),
  listAllPlans: () => SubscriptionPlanModel.find({}).sort({ createdAt: -1 }),
  updatePlanByCode: (code: string, payload: Record<string, unknown>) =>
    SubscriptionPlanModel.findOneAndUpdate(
      { code },
      { $set: payload },
      { returnDocument: "after" },
    ),
  listActivePlansByActorType: (actorType: ActorType) =>
    SubscriptionPlanModel.find({ isActive: true, actorTypes: actorType }).sort({ priceInr: 1 }),
  createAccountSubscription: async (payload: Record<string, unknown>, session?: ClientSession) => {
    if (session) {
      const rows = await AccountSubscriptionModel.create([payload], { session });
      return rows[0] ?? null;
    }
    return AccountSubscriptionModel.create(payload);
  },
  findAccountSubscriptionById: (subscriptionId: string, session?: ClientSession) =>
    AccountSubscriptionModel.findById(subscriptionId, undefined, session ? { session } : undefined),
  findLatestByActor: (actorType: ActorType, actorId: string) =>
    AccountSubscriptionModel.findOne({ actorType, actorId }).sort({ createdAt: -1 }),
  findByPaymentReference: (paymentReference: string) =>
    AccountSubscriptionModel.findOne({ paymentReference: paymentReference.trim() }),
  findByProviderPaymentId: (providerPaymentId: string, session?: ClientSession) =>
    AccountSubscriptionModel.findOne(
      { providerPaymentId: providerPaymentId.trim() },
      undefined,
      session ? { session } : undefined,
    ),
  findByProviderOrderId: (providerOrderId: string, session?: ClientSession) =>
    AccountSubscriptionModel.findOne(
      { providerOrderId: providerOrderId.trim() },
      undefined,
      session ? { session } : undefined,
    ),
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

    const limit =
      typeof filters.limit === "number" ? Math.max(1, Math.min(300, filters.limit)) : 120;
    return AccountSubscriptionModel.find(query).sort({ createdAt: -1 }).limit(limit);
  },
  listSubscriptionsPaginated: async (filters: {
    status?: string;
    paymentStatus?: string;
    actorType?: ActorType;
    planCode?: string;
    page?: number;
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

    const limit =
      typeof filters.limit === "number" && Number.isFinite(filters.limit)
        ? Math.max(1, Math.min(300, Math.floor(filters.limit)))
        : 25;
    const page =
      typeof filters.page === "number" && Number.isFinite(filters.page)
        ? Math.max(1, Math.floor(filters.page))
        : 1;
    const skip = (page - 1) * limit;

    const [items, total] = await Promise.all([
      AccountSubscriptionModel.find(query).sort({ createdAt: -1 }).skip(skip).limit(limit),
      AccountSubscriptionModel.countDocuments(query),
    ]);

    return {
      items,
      total,
      page,
      limit,
      totalPages: Math.max(1, Math.ceil(total / limit)),
    };
  },
  findActiveProByActorIds: async (actorType: ActorType, actorIds: string[]) => {
    if (!actorIds.length) {
      return [];
    }

    return AccountSubscriptionModel.find({
      actorType,
      actorId: { $in: actorIds },
      planCode: { $ne: "FREE" },
      status: "active",
      paymentStatus: "confirmed",
      $or: [{ endsAt: null }, { endsAt: { $gte: new Date() } }],
    }).select({ actorId: 1 });
  },
  updateSubscriptionById: (
    subscriptionId: string,
    payload: Record<string, unknown>,
    session?: ClientSession,
  ) =>
    AccountSubscriptionModel.findByIdAndUpdate(
      subscriptionId,
      payload,
      session ? { returnDocument: "after", session } : { returnDocument: "after" },
    ),
  markWebhookEventProcessed: async (eventId: string, eventType: string, payloadHash: string) => {
    try {
      const result = await RazorpayWebhookEventModel.updateOne(
        { eventId: eventId.trim() },
        {
          $setOnInsert: {
            eventId: eventId.trim(),
            eventType: eventType.trim(),
            payloadHash: payloadHash.trim(),
            receivedAt: new Date(),
          },
        },
        { upsert: true },
      );

      return result.upsertedCount > 0;
    } catch (error: unknown) {
      const err = error as Record<string, unknown> & { code?: number; codeName?: string };
      if (err && (err.code === 11000 || err.codeName === "DuplicateKey")) {
        return false;
      }
      throw error;
    }
  },
};
