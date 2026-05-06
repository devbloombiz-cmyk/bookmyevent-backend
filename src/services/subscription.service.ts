import { subscriptionRepository } from "../repositories/subscription.repository";
import { vendorRepository } from "../repositories/vendor.repository";
import { venueOwnerRepository } from "../repositories/venue-owner.repository";
import { userRepository } from "../repositories/user.repository";
import { ApiError } from "../utils/api-error";
import { VendorPackageModel } from "../models/vendor-package.model";
import type { AuthenticatedUser } from "../types/auth-user";
import crypto from "crypto";
import { env } from "../config/env";

type ActorType = "vendor" | "venue_owner";
type PlanCode = "FREE" | "PRO_YEARLY_4999";

type SubscriptionLimits = {
  maxPortfolioImages: number;
  maxVideoLinks: number;
  maxPackages: number;
};

type UsageSnapshot = {
  portfolioImages: number;
  videoLinks: number;
  packages: number;
};

const FREE_PLAN_CODE: PlanCode = "FREE";
const PRO_PLAN_CODE: PlanCode = "PRO_YEARLY_4999";

const MS_PER_DAY = 24 * 60 * 60 * 1000;

const defaultFreeLimits: SubscriptionLimits = {
  maxPortfolioImages: 0,
  maxVideoLinks: 0,
  maxPackages: 3,
};

const defaultProLimits: SubscriptionLimits = {
  maxPortfolioImages: -1,
  maxVideoLinks: -1,
  maxPackages: -1,
};

const normalizeDate = (value: unknown) => {
  if (!value) {
    return null;
  }

  const date = new Date(String(value));
  return Number.isNaN(date.getTime()) ? null : date;
};

const countVenueOwnerPortfolioImages = (venueOwner: Record<string, unknown>) => {
  const profileImages = Array.isArray(venueOwner.profileImages)
    ? venueOwner.profileImages.filter((item): item is string => typeof item === "string" && item.trim().length > 0).length
    : 0;

  const packageImages = Array.isArray(venueOwner.venuePackages)
    ? venueOwner.venuePackages.reduce((acc, pkg) => {
        if (!pkg || typeof pkg !== "object") {
          return acc;
        }

        const value = (pkg as Record<string, unknown>).portfolioImages;
        const count = Array.isArray(value)
          ? value.filter((item): item is string => typeof item === "string" && item.trim().length > 0).length
          : 0;

        return acc + count;
      }, 0)
    : 0;

  return profileImages + packageImages;
};

const countVenueOwnerVideoLinks = (venueOwner: Record<string, unknown>) => {
  return Array.isArray(venueOwner.venuePackages)
    ? venueOwner.venuePackages.reduce((acc, pkg) => {
        if (!pkg || typeof pkg !== "object") {
          return acc;
        }

        const links = (pkg as Record<string, unknown>).videoLinks;
        const count = Array.isArray(links)
          ? links.filter((item): item is string => typeof item === "string" && item.trim().length > 0).length
          : 0;

        return acc + count;
      }, 0)
    : 0;
};

const parseActorType = (authUser: Pick<AuthenticatedUser, "role">): ActorType => {
  if (authUser.role === "vendor") {
    return "vendor";
  }

  if (authUser.role === "venue_owner") {
    return "venue_owner";
  }

  throw new ApiError(403, "Subscription access is only available for vendor and venue owner accounts");
};

const ensureBasePlans = async () => {
  await Promise.all([
    subscriptionRepository.upsertPlanByCode(FREE_PLAN_CODE, {
      code: FREE_PLAN_CODE,
      name: "Free",
      description: "Default plan with baseline limits",
      actorTypes: ["vendor", "venue_owner"],
      priceInr: 0,
      billingCycle: "yearly",
      limits: defaultFreeLimits,
      isActive: true,
    }),
    subscriptionRepository.upsertPlanByCode(PRO_PLAN_CODE, {
      code: PRO_PLAN_CODE,
      name: "Pro Yearly",
      description: "Yearly subscription with expanded limits",
      actorTypes: ["vendor", "venue_owner"],
      priceInr: 4999,
      billingCycle: "yearly",
      limits: defaultProLimits,
      isActive: true,
    }),
  ]);
};

const resolveActor = async (authUser: Pick<AuthenticatedUser, "id" | "role">) => {
  const actorType = parseActorType(authUser);

  if (actorType === "vendor") {
    const vendorByUserId = await vendorRepository.findByUserId(authUser.id);
    if (vendorByUserId) {
      return { actorType, actorId: String(vendorByUserId._id), actorRecord: vendorByUserId.toObject() };
    }

    const user = await userRepository.findById(authUser.id);
    if (!user) {
      throw new ApiError(404, "User not found");
    }

    const vendor = await vendorRepository.findByEmailOrMobile(user.email, user.mobile);
    if (!vendor) {
      throw new ApiError(404, "Vendor profile not found");
    }

    if (!vendor.userId) {
      await vendorRepository.updateById(String(vendor._id), { userId: authUser.id });
    }

    return { actorType, actorId: String(vendor._id), actorRecord: vendor.toObject() };
  }

  const venueOwnerByUserId = await venueOwnerRepository.findByUserId(authUser.id);
  if (venueOwnerByUserId) {
    return {
      actorType,
      actorId: String(venueOwnerByUserId._id),
      actorRecord: venueOwnerByUserId.toObject(),
    };
  }

  const user = await userRepository.findById(authUser.id);
  if (!user) {
    throw new ApiError(404, "User not found");
  }

  const venueOwner = await venueOwnerRepository.findByEmailOrMobile(user.email, user.mobile);
  if (!venueOwner) {
    throw new ApiError(404, "Venue owner profile not found");
  }

  if (!venueOwner.userId) {
    await venueOwnerRepository.updateById(String(venueOwner._id), { userId: authUser.id });
  }

  return { actorType, actorId: String(venueOwner._id), actorRecord: venueOwner.toObject() };
};

const toLimits = (value: unknown): SubscriptionLimits => {
  const src = typeof value === "object" && value !== null ? (value as Record<string, unknown>) : {};
  const asLimit = (input: unknown, fallback: number) =>
    typeof input === "number" && Number.isFinite(input) ? Math.floor(input) : fallback;

  return {
    maxPortfolioImages: asLimit(src.maxPortfolioImages, defaultFreeLimits.maxPortfolioImages),
    maxVideoLinks: asLimit(src.maxVideoLinks, defaultFreeLimits.maxVideoLinks),
    maxPackages: asLimit(src.maxPackages, defaultFreeLimits.maxPackages),
  };
};

const computeUsageForActor = async (actorType: ActorType, actorId: string, actorRecord: Record<string, unknown>) => {
  if (actorType === "vendor") {
    const portfolioImages = Array.isArray(actorRecord.portfolioImages)
      ? actorRecord.portfolioImages.filter((item): item is string => typeof item === "string" && item.trim().length > 0).length
      : 0;

    const videoLinks = Array.isArray(actorRecord.videoLinks)
      ? actorRecord.videoLinks.filter((item): item is string => typeof item === "string" && item.trim().length > 0).length
      : 0;

    const packages = await VendorPackageModel.countDocuments({ vendorId: actorId });

    return { portfolioImages, videoLinks, packages } satisfies UsageSnapshot;
  }

  return {
    portfolioImages: countVenueOwnerPortfolioImages(actorRecord),
    videoLinks: countVenueOwnerVideoLinks(actorRecord),
    packages: Array.isArray(actorRecord.venuePackages) ? actorRecord.venuePackages.length : 0,
  } satisfies UsageSnapshot;
};

const resolveCurrentSubscription = async (actorType: ActorType, actorId: string) => {
  await ensureBasePlans();

  const latest = await subscriptionRepository.findLatestByActor(actorType, actorId);
  const now = new Date();

  if (latest) {
    const endsAt = normalizeDate((latest as { endsAt?: unknown }).endsAt);
    const paymentStatus = String((latest as { paymentStatus?: unknown }).paymentStatus ?? "pending");
    const status = String((latest as { status?: unknown }).status ?? "inactive");

    const hasNotExpired = !endsAt || endsAt.getTime() >= now.getTime();
    if (paymentStatus === "confirmed" && status === "active" && hasNotExpired) {
      const plan = await subscriptionRepository.getPlanByCode(String((latest as { planCode?: unknown }).planCode ?? FREE_PLAN_CODE));

      return {
        subscription: latest,
        planCode: String((latest as { planCode?: unknown }).planCode ?? FREE_PLAN_CODE),
        plan,
      };
    }

    if (endsAt && endsAt.getTime() < now.getTime() && status === "active") {
      await subscriptionRepository.updateSubscriptionById(String((latest as { _id?: unknown })._id ?? ""), {
        status: "expired",
      });
    }
  }

  const freePlan = await subscriptionRepository.getPlanByCode(FREE_PLAN_CODE);
  return {
    subscription: null,
    planCode: FREE_PLAN_CODE,
    plan: freePlan,
  };
};

const buildPolicySnapshot = async (authUser: Pick<AuthenticatedUser, "id" | "role">) => {
  const actor = await resolveActor(authUser);
  const current = await resolveCurrentSubscription(actor.actorType, actor.actorId);
  const planLimits = toLimits((current.plan as { limits?: unknown } | null)?.limits);
  const usage = await computeUsageForActor(actor.actorType, actor.actorId, actor.actorRecord);

  return {
    actor,
    usage,
    limits: planLimits,
    planCode: current.planCode,
    planName: (current.plan as { name?: unknown } | null)?.name
      ? String((current.plan as { name?: unknown }).name)
      : current.planCode,
    subscription: current.subscription,
    planPriceInr: Number((current.plan as { priceInr?: unknown } | null)?.priceInr ?? 0),
  };
};

export const subscriptionService = {
  getMySubscriptionOverview: async (authUser: Pick<AuthenticatedUser, "id" | "role">) => {
    const snapshot = await buildPolicySnapshot(authUser);

    return {
      actorType: snapshot.actor.actorType,
      actorId: snapshot.actor.actorId,
      planCode: snapshot.planCode,
      planName: snapshot.planName,
      planPriceInr: snapshot.planPriceInr,
      limits: snapshot.limits,
      usage: snapshot.usage,
      subscription: snapshot.subscription,
    };
  },
  listMyEligiblePlans: async (authUser: Pick<AuthenticatedUser, "id" | "role">) => {
    await ensureBasePlans();
    const actorType = parseActorType(authUser);
    return subscriptionRepository.listActivePlansByActorType(actorType);
  },
  createCheckoutIntent: async (
    authUser: Pick<AuthenticatedUser, "id" | "role">,
    payload: { planCode: PlanCode; paymentProvider?: "manual" | "razorpay"; paymentReference?: string },
  ) => {
    const actor = await resolveActor(authUser);
    await ensureBasePlans();

    if (payload.planCode !== PRO_PLAN_CODE) {
      throw new ApiError(400, "Only PRO_YEARLY_4999 is supported for checkout intent");
    }

    const plan = await subscriptionRepository.getPlanByCode(payload.planCode);
    if (!plan || !plan.isActive) {
      throw new ApiError(404, "Subscription plan is not available");
    }

    if (!Array.isArray(plan.actorTypes) || !plan.actorTypes.includes(actor.actorType)) {
      throw new ApiError(403, "Selected plan is not available for this account type");
    }

    const paymentReference = (payload.paymentReference || "").trim();
    if (paymentReference) {
      const existingByRef = await subscriptionRepository.findByPaymentReference(paymentReference);
      if (existingByRef) {
        throw new ApiError(409, "Payment reference already exists");
      }
    }

    const subscription = await subscriptionRepository.createAccountSubscription({
      actorType: actor.actorType,
      actorId: actor.actorId,
      planCode: payload.planCode,
      status: "pending_payment",
      paymentStatus: "pending",
      paymentProvider: payload.paymentProvider || "manual",
      paymentReference,
      amountInr: Number(plan.priceInr || 0),
      startsAt: null,
      endsAt: null,
      createdBy: authUser.id,
      updatedBy: authUser.id,
      metadata: {
        checkoutMode: "static",
      },
    });

    return subscription;
  },
  confirmPaymentByAdmin: async (
    subscriptionId: string,
    payload: {
      paymentReference?: string;
      providerPaymentId?: string;
      providerOrderId?: string;
      providerSignature?: string;
      amountInr?: number;
    },
    adminUserId: string,
  ) => {
    const existing = await subscriptionRepository.findAccountSubscriptionById(subscriptionId);
    if (!existing) {
      throw new ApiError(404, "Subscription request not found");
    }

    if (existing.paymentStatus === "confirmed" && existing.status === "active") {
      return existing;
    }

    const plan = await subscriptionRepository.getPlanByCode(existing.planCode);
    if (!plan || !plan.isActive) {
      throw new ApiError(400, "Plan is missing or inactive");
    }

    const now = new Date();
    const currentEndsAt = normalizeDate(existing.endsAt);
    const startsAt = currentEndsAt && currentEndsAt.getTime() > now.getTime() ? currentEndsAt : now;
    const endsAt = new Date(startsAt.getTime() + 365 * MS_PER_DAY);

    const updated = await subscriptionRepository.updateSubscriptionById(subscriptionId, {
      paymentStatus: "confirmed",
      status: "active",
      startsAt,
      endsAt,
      confirmedAt: now,
      paymentReference: (payload.paymentReference || existing.paymentReference || "").trim(),
      providerPaymentId: (payload.providerPaymentId || existing.providerPaymentId || "").trim(),
      providerOrderId: (payload.providerOrderId || existing.providerOrderId || "").trim(),
      providerSignature: (payload.providerSignature || existing.providerSignature || "").trim(),
      amountInr:
        typeof payload.amountInr === "number" && payload.amountInr >= 0
          ? payload.amountInr
          : Number(existing.amountInr || plan.priceInr || 0),
      updatedBy: adminUserId,
    });

    if (!updated) {
      throw new ApiError(404, "Subscription request not found");
    }

    return updated;
  },
  listSubscriptionsForAdmin: async (filters: {
    status?: "inactive" | "pending_payment" | "active" | "expired" | "cancelled";
    paymentStatus?: "pending" | "confirmed" | "failed";
    actorType?: "vendor" | "venue_owner";
    planCode?: PlanCode;
    limit?: number;
  }) => {
    await ensureBasePlans();
    return subscriptionRepository.listSubscriptions(filters);
  },
  confirmPaymentByProviderPaymentId: async (
    providerPaymentId: string,
    payload: {
      paymentReference?: string;
      providerOrderId?: string;
      providerSignature?: string;
      amountInr?: number;
    },
  ) => {
    const existing = await subscriptionRepository.findByProviderPaymentId(providerPaymentId);
    if (!existing) {
      throw new ApiError(404, "Subscription request not found for payment id");
    }

    if (existing.paymentStatus === "confirmed" && existing.status === "active") {
      return existing;
    }

    const plan = await subscriptionRepository.getPlanByCode(existing.planCode);
    if (!plan || !plan.isActive) {
      throw new ApiError(400, "Plan is missing or inactive");
    }

    const now = new Date();
    const currentEndsAt = normalizeDate(existing.endsAt);
    const startsAt = currentEndsAt && currentEndsAt.getTime() > now.getTime() ? currentEndsAt : now;
    const endsAt = new Date(startsAt.getTime() + 365 * MS_PER_DAY);

    const updated = await subscriptionRepository.updateSubscriptionById(String(existing._id), {
      paymentStatus: "confirmed",
      status: "active",
      startsAt,
      endsAt,
      confirmedAt: now,
      paymentReference: (payload.paymentReference || existing.paymentReference || "").trim(),
      providerPaymentId: providerPaymentId.trim(),
      providerOrderId: (payload.providerOrderId || existing.providerOrderId || "").trim(),
      providerSignature: (payload.providerSignature || existing.providerSignature || "").trim(),
      amountInr:
        typeof payload.amountInr === "number" && payload.amountInr >= 0
          ? payload.amountInr
          : Number(existing.amountInr || plan.priceInr || 0),
      updatedBy: existing.updatedBy || null,
    });

    if (!updated) {
      throw new ApiError(404, "Subscription request not found");
    }

    return updated;
  },
  processRazorpayWebhook: async (payload: Record<string, unknown>, signatureHeader: string) => {
    if (!env.RAZORPAY_WEBHOOK_SECRET) {
      throw new ApiError(500, "RAZORPAY_WEBHOOK_SECRET is not configured");
    }

    const expected = crypto
      .createHmac("sha256", env.RAZORPAY_WEBHOOK_SECRET)
      .update(JSON.stringify(payload))
      .digest("hex");

    const provided = String(signatureHeader || "").trim();
    if (!provided || provided !== expected) {
      throw new ApiError(401, "Invalid Razorpay webhook signature");
    }

    const event = String(payload.event || "");
    const entity =
      typeof payload.payload === "object" && payload.payload !== null
        ? (payload.payload as Record<string, unknown>)
        : {};

    const paymentEntity =
      typeof entity.payment === "object" && entity.payment !== null
        ? (entity.payment as Record<string, unknown>)
        : {};

    const paymentObject =
      typeof paymentEntity.entity === "object" && paymentEntity.entity !== null
        ? (paymentEntity.entity as Record<string, unknown>)
        : {};

    const providerPaymentId = String(paymentObject.id || "").trim();
    const providerOrderId = String(paymentObject.order_id || "").trim();
    const amountInr = typeof paymentObject.amount === "number" ? Number(paymentObject.amount) / 100 : undefined;

    if (!providerPaymentId) {
      throw new ApiError(400, "Webhook payload does not contain payment id");
    }

    if (event === "payment.captured" || event === "order.paid") {
      const updated = await subscriptionService.confirmPaymentByProviderPaymentId(providerPaymentId, {
        providerOrderId,
        providerSignature: provided,
        amountInr,
      });

      return {
        processed: true,
        event,
        subscriptionId: String(updated._id),
      };
    }

    return {
      processed: false,
      event,
      reason: "Ignored webhook event",
    };
  },
  assertWithinLimit: async (
    authUser: Pick<AuthenticatedUser, "id" | "role">,
    key: keyof SubscriptionLimits,
    nextUsageValue: number,
  ) => {
    const snapshot = await buildPolicySnapshot(authUser);
    const limit = snapshot.limits[key];

    if (limit < 0) {
      return snapshot;
    }

    if (nextUsageValue <= limit) {
      return snapshot;
    }

    throw new ApiError(
      403,
      `SUBSCRIPTION_LIMIT_REACHED:${key}:${nextUsageValue}:${limit}:upgrade_required:${PRO_PLAN_CODE}`,
    );
  },
};
