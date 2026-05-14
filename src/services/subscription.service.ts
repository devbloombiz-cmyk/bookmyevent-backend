import { subscriptionRepository } from "../repositories/subscription.repository";
import { vendorRepository } from "../repositories/vendor.repository";
import { venueOwnerRepository } from "../repositories/venue-owner.repository";
import { userRepository } from "../repositories/user.repository";
import { ApiError } from "../utils/api-error";
import { VendorPackageModel } from "../models/vendor-package.model";
import type { AuthenticatedUser } from "../types/auth-user";
import crypto from "crypto";
import { env } from "../config/env";
import { logger } from "../config/logger";
import Razorpay from "razorpay";
import mongoose from "mongoose";

type ActorType = "vendor" | "venue_owner";
type PlanCode = string;

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
const DEFAULT_PRO_PLAN_CODE: PlanCode = "PRO_YEARLY_4999";

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
  const [freePlan, defaultProPlan] = await Promise.all([
    subscriptionRepository.getPlanByCode(FREE_PLAN_CODE),
    subscriptionRepository.getPlanByCode(DEFAULT_PRO_PLAN_CODE),
  ]);

  if (!freePlan) {
    await subscriptionRepository.createPlan({
      code: FREE_PLAN_CODE,
      name: "Free",
      description: "Default plan with baseline limits",
      actorTypes: ["vendor", "venue_owner"],
      priceInr: 0,
      billingCycle: "yearly",
      limits: defaultFreeLimits,
      isActive: true,
    });
  }

  if (!defaultProPlan) {
    await subscriptionRepository.createPlan({
      code: DEFAULT_PRO_PLAN_CODE,
      name: "Pro Yearly",
      description: "Yearly subscription with expanded limits",
      actorTypes: ["vendor", "venue_owner"],
      priceInr: 4999,
      billingCycle: "yearly",
      limits: defaultProLimits,
      isActive: true,
    });
  }
};

const normalizePlanCode = (value: string) => value.trim().toUpperCase();

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

const resolveRazorpayCredentials = () => {
  if (env.RAZORPAY_ENV === "live") {
    const keyId = (env.RAZORPAY_KEY_ID_LIVE || env.RAZORPAY_KEY_ID || "").trim();
    const keySecret = (env.RAZORPAY_KEY_SECRET_LIVE || env.RAZORPAY_KEY_SECRET || "").trim();
    return { keyId, keySecret };
  }

  const keyId = (env.RAZORPAY_KEY_ID_TEST || env.RAZORPAY_KEY_ID || "").trim();
  const keySecret = (env.RAZORPAY_KEY_SECRET_TEST || env.RAZORPAY_KEY_SECRET || "").trim();
  return { keyId, keySecret };
};

const buildRazorpayClient = () => {
  const { keyId, keySecret } = resolveRazorpayCredentials();
  if (!keyId || !keySecret) {
    throw new ApiError(500, "Razorpay credentials are not configured for current RAZORPAY_ENV");
  }

  return {
    client: new Razorpay({ key_id: keyId, key_secret: keySecret }),
    keyId,
    keySecret,
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
  listPlansForAdmin: async () => {
    await ensureBasePlans();
    return subscriptionRepository.listAllPlans();
  },
  createPlanByAdmin: async (
    payload: {
      code: string;
      actorTypes?: ActorType[];
      name: string;
      description?: string;
      priceInr: number;
      billingCycle: "yearly" | "monthly" | "one_time";
      limits: SubscriptionLimits;
      isActive?: boolean;
    },
    adminUserId: string,
  ) => {
    await ensureBasePlans();
    const code = normalizePlanCode(payload.code);
    if (!code || code === FREE_PLAN_CODE) {
      throw new ApiError(400, "Plan code is invalid");
    }

    const existing = await subscriptionRepository.getPlanByCode(code);
    if (existing) {
      throw new ApiError(409, "Subscription plan code already exists");
    }

    const actorTypes = payload.actorTypes?.length
      ? payload.actorTypes
      : (["vendor", "venue_owner"] as ActorType[]);

    const created = await subscriptionRepository.createPlan({
      code,
      actorTypes,
      name: payload.name.trim(),
      description: (payload.description || "").trim(),
      priceInr: Math.max(0, Math.round(payload.priceInr || 0)),
      billingCycle: payload.billingCycle,
      limits: {
        maxPortfolioImages: Math.floor(payload.limits.maxPortfolioImages),
        maxVideoLinks: Math.floor(payload.limits.maxVideoLinks),
        maxPackages: Math.floor(payload.limits.maxPackages),
      },
      isActive: payload.isActive !== false,
      createdBy: adminUserId,
      updatedBy: adminUserId,
    });

    return created;
  },
  updatePlanByAdmin: async (
    code: string,
    payload: {
      actorTypes?: ActorType[];
      name?: string;
      description?: string;
      priceInr?: number;
      billingCycle?: "yearly" | "monthly" | "one_time";
      limits?: Partial<SubscriptionLimits>;
      isActive?: boolean;
    },
    adminUserId: string,
  ) => {
    await ensureBasePlans();
    const normalizedCode = normalizePlanCode(code);
    if (!normalizedCode) {
      throw new ApiError(400, "Plan code is invalid");
    }

    const existing = await subscriptionRepository.getPlanByCode(normalizedCode);
    if (!existing) {
      throw new ApiError(404, "Subscription plan not found");
    }

    if (normalizedCode === FREE_PLAN_CODE && payload.isActive === false) {
      throw new ApiError(400, "FREE plan cannot be disabled");
    }

    const nextLimits = {
      ...toLimits((existing as { limits?: unknown }).limits),
      ...(payload.limits || {}),
    };

    const updated = await subscriptionRepository.updatePlanByCode(normalizedCode, {
      actorTypes: payload.actorTypes?.length ? payload.actorTypes : existing.actorTypes,
      name: payload.name !== undefined ? payload.name.trim() : existing.name,
      description: payload.description !== undefined ? payload.description.trim() : existing.description,
      priceInr:
        typeof payload.priceInr === "number"
          ? Math.max(0, Math.round(payload.priceInr))
          : Number(existing.priceInr || 0),
      billingCycle: payload.billingCycle || existing.billingCycle,
      limits: {
        maxPortfolioImages: Math.floor(nextLimits.maxPortfolioImages),
        maxVideoLinks: Math.floor(nextLimits.maxVideoLinks),
        maxPackages: Math.floor(nextLimits.maxPackages),
      },
      isActive: payload.isActive ?? existing.isActive,
      updatedBy: adminUserId,
    });

    if (!updated) {
      throw new ApiError(404, "Subscription plan not found");
    }

    return updated;
  },
  createCheckoutIntent: async (
    authUser: Pick<AuthenticatedUser, "id" | "role">,
    payload: { planCode: string; paymentProvider?: "manual" | "razorpay"; paymentReference?: string },
  ) => {
    const actor = await resolveActor(authUser);
    await ensureBasePlans();

    const planCode = normalizePlanCode(payload.planCode);
    if (!planCode) {
      throw new ApiError(400, "Plan code is required");
    }
    if (planCode === FREE_PLAN_CODE) {
      throw new ApiError(400, "FREE plan cannot be used for checkout intent");
    }

    const plan = await subscriptionRepository.getPlanByCode(planCode);
    if (!plan || !plan.isActive) {
      throw new ApiError(404, "Subscription plan is not available");
    }
    if (Number(plan.priceInr || 0) <= 0) {
      throw new ApiError(400, "Selected plan is not configured for paid checkout");
    }

    if (!Array.isArray(plan.actorTypes) || !plan.actorTypes.includes(actor.actorType)) {
      throw new ApiError(403, "Selected plan is not available for this account type");
    }

    const latest = await subscriptionRepository.findLatestByActor(actor.actorType, actor.actorId);
    if (latest) {
      const latestEndsAt = normalizeDate((latest as { endsAt?: unknown }).endsAt);
      const latestPlanCode = String((latest as { planCode?: unknown }).planCode || "");
      const latestStatus = String((latest as { status?: unknown }).status || "");
      const latestPaymentStatus = String((latest as { paymentStatus?: unknown }).paymentStatus || "");
      const latestProvider = String((latest as { paymentProvider?: unknown }).paymentProvider || "");

      const stillActive =
        latestStatus === "active" &&
        latestPaymentStatus === "confirmed" &&
        latestPlanCode === planCode &&
        (!latestEndsAt || latestEndsAt.getTime() >= Date.now());

      if (stillActive) {
        throw new ApiError(409, "Pro subscription is already active");
      }

      const canReusePendingRazorpayOrder =
        (payload.paymentProvider || "manual") === "razorpay" &&
        latestPlanCode === planCode &&
        latestStatus === "pending_payment" &&
        latestPaymentStatus === "pending" &&
        latestProvider === "razorpay" &&
        Boolean((latest as { providerOrderId?: unknown }).providerOrderId);

      if (canReusePendingRazorpayOrder) {
        const { keyId } = buildRazorpayClient();
        const amountInr = Number((latest as { amountInr?: unknown }).amountInr || plan.priceInr || 0);
        const amountPaise = Math.round(amountInr * 100);

        return {
          subscription: latest,
          checkout: {
            provider: "razorpay" as const,
            keyId,
            orderId: String((latest as { providerOrderId?: unknown }).providerOrderId || "").trim(),
            amountPaise,
            currency: "INR" as const,
            subscriptionId: String((latest as { _id?: unknown })._id || ""),
            planCode,
          },
        };
      }
    }

    const paymentReference = (payload.paymentReference || "").trim();
    if (paymentReference) {
      const existingByRef = await subscriptionRepository.findByPaymentReference(paymentReference);
      if (existingByRef) {
        throw new ApiError(409, "Payment reference already exists");
      }
    }

    if ((payload.paymentProvider || "manual") === "razorpay") {
      const { client, keyId } = buildRazorpayClient();
      const amountInr = Number(plan.priceInr || 0);
      const amountPaise = Math.round(amountInr * 100);

      if (!Number.isFinite(amountPaise) || amountPaise <= 0) {
        throw new ApiError(400, "Invalid plan amount for Razorpay checkout");
      }

      const receipt = `sub_${actor.actorType}_${Date.now()}`.slice(0, 40);

      const order = await client.orders.create({
        amount: amountPaise,
        currency: "INR",
        receipt,
        notes: {
          actorType: actor.actorType,
          actorId: actor.actorId,
          planCode,
        },
      });

      const subscription = await subscriptionRepository.createAccountSubscription({
        actorType: actor.actorType,
        actorId: actor.actorId,
        planCode,
        status: "pending_payment",
        paymentStatus: "pending",
        paymentProvider: "razorpay",
        paymentReference,
        providerOrderId: String(order.id || "").trim(),
        amountInr,
        startsAt: null,
        endsAt: null,
        createdBy: authUser.id,
        updatedBy: authUser.id,
        metadata: {
          checkoutMode: "razorpay",
          razorpayOrderStatus: String(order.status || "created"),
          currency: "INR",
        },
      });

      return {
        subscription,
        checkout: {
          provider: "razorpay",
          keyId,
          orderId: String(order.id || "").trim(),
          amountPaise,
          currency: "INR",
          subscriptionId: String((subscription as { _id?: unknown })._id || ""),
          planCode,
        },
      };
    }

    const subscription = await subscriptionRepository.createAccountSubscription({
      actorType: actor.actorType,
      actorId: actor.actorId,
      planCode,
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

    return {
      subscription,
      checkout: null,
    };
  },
  confirmMyRazorpayPayment: async (
    authUser: Pick<AuthenticatedUser, "id" | "role">,
    payload: {
      subscriptionId: string;
      razorpayOrderId: string;
      razorpayPaymentId: string;
      razorpaySignature: string;
    },
  ) => {
    const actor = await resolveActor(authUser);
    const subscriptionId = payload.subscriptionId.trim();
    const razorpayOrderId = payload.razorpayOrderId.trim();
    const razorpayPaymentId = payload.razorpayPaymentId.trim();
    const razorpaySignature = payload.razorpaySignature.trim();

    if (!subscriptionId || !razorpayOrderId || !razorpayPaymentId || !razorpaySignature) {
      throw new ApiError(400, "Missing Razorpay confirmation fields");
    }

    const { keySecret } = buildRazorpayClient();

    const expectedSignature = crypto
      .createHmac("sha256", keySecret)
      .update(`${razorpayOrderId}|${razorpayPaymentId}`)
      .digest("hex");

    const providedDigest = Buffer.from(razorpaySignature, "hex");
    const expectedDigest = Buffer.from(expectedSignature, "hex");
    if (
      providedDigest.length !== expectedDigest.length ||
      !crypto.timingSafeEqual(providedDigest, expectedDigest)
    ) {
      throw new ApiError(401, "Invalid Razorpay payment signature");
    }

    const now = new Date();
    const session = await mongoose.startSession();

    try {
      let updatedSubscription: unknown = null;

      await session.withTransaction(async () => {
        const existing = await subscriptionRepository.findAccountSubscriptionById(subscriptionId, session);
        if (!existing) {
          throw new ApiError(404, "Subscription request not found");
        }

        if (existing.actorType !== actor.actorType || String(existing.actorId) !== actor.actorId) {
          throw new ApiError(403, "Subscription does not belong to current account");
        }

        if (existing.paymentProvider !== "razorpay") {
          throw new ApiError(400, "Subscription is not a Razorpay checkout request");
        }

        if (existing.providerOrderId && existing.providerOrderId !== razorpayOrderId) {
          throw new ApiError(400, "Razorpay order id mismatch");
        }

        if (existing.paymentStatus === "confirmed" && existing.status === "active") {
          if (!existing.providerPaymentId || existing.providerPaymentId === razorpayPaymentId) {
            updatedSubscription = existing;
            return;
          }
          throw new ApiError(409, "Subscription already confirmed with a different payment id");
        }

        const paymentAlreadyLinked = await subscriptionRepository.findByProviderPaymentId(
          razorpayPaymentId,
          session,
        );

        if (paymentAlreadyLinked && String(paymentAlreadyLinked._id) !== String(existing._id)) {
          throw new ApiError(409, "Razorpay payment id is already linked to another subscription");
        }

        const plan = await subscriptionRepository.getPlanByCode(existing.planCode);
        if (!plan || !plan.isActive) {
          throw new ApiError(400, "Plan is missing or inactive");
        }

        const currentEndsAt = normalizeDate(existing.endsAt);
        const startsAt = currentEndsAt && currentEndsAt.getTime() > now.getTime() ? currentEndsAt : now;
        const endsAt = new Date(startsAt.getTime() + 365 * MS_PER_DAY);

        updatedSubscription = await subscriptionRepository.updateSubscriptionById(
          String(existing._id),
          {
            paymentStatus: "confirmed",
            status: "active",
            startsAt,
            endsAt,
            confirmedAt: now,
            providerOrderId: razorpayOrderId,
            providerPaymentId: razorpayPaymentId,
            providerSignature: razorpaySignature,
            amountInr: Number(existing.amountInr || plan.priceInr || 0),
            updatedBy: authUser.id,
            metadata: {
              ...(typeof existing.metadata === "object" && existing.metadata ? existing.metadata : {}),
              paymentConfirmedBy: "razorpay_callback",
              paymentConfirmedAt: now.toISOString(),
            },
          },
          session,
        );
      });

      if (!updatedSubscription) {
        throw new ApiError(500, "Unable to confirm Razorpay payment");
      }

      return updatedSubscription;
    } finally {
      await session.endSession();
    }
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
    planCode?: string;
    page?: number;
    limit?: number;
  }) => {
    await ensureBasePlans();
    return subscriptionRepository.listSubscriptionsPaginated(filters);
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
  processRazorpayWebhook: async (rawBody: Buffer, signatureHeader: string) => {
    const webhookSecret =
      env.RAZORPAY_ENV === "live"
        ? env.RAZORPAY_WEBHOOK_SECRET_LIVE || env.RAZORPAY_WEBHOOK_SECRET
        : env.RAZORPAY_WEBHOOK_SECRET_TEST || env.RAZORPAY_WEBHOOK_SECRET;

    if (!webhookSecret) {
      throw new ApiError(500, "Razorpay webhook secret is not configured for current RAZORPAY_ENV");
    }

    const providedSignature = String(signatureHeader || "").trim();
    if (!/^[a-fA-F0-9]{64}$/.test(providedSignature)) {
      throw new ApiError(401, "Invalid Razorpay webhook signature");
    }

    // Security: compute HMAC directly from the raw request bytes from Razorpay.
    const expectedDigest = crypto.createHmac("sha256", webhookSecret).update(rawBody).digest();
    const providedDigest = Buffer.from(providedSignature, "hex");

    // Security: constant-time comparison prevents timing attacks.
    if (providedDigest.length !== expectedDigest.length || !crypto.timingSafeEqual(providedDigest, expectedDigest)) {
      throw new ApiError(401, "Invalid Razorpay webhook signature");
    }

    let payload: Record<string, unknown>;
    try {
      // Security: only parse JSON after signature verification succeeds.
      payload = JSON.parse(rawBody.toString("utf8")) as Record<string, unknown>;
    } catch {
      throw new ApiError(400, "Invalid Razorpay webhook payload");
    }

    const eventId = String(payload.id || "").trim();
    const eventType = String(payload.event || "").trim();

    if (!eventId || !eventType) {
      throw new ApiError(400, "Webhook payload is missing event id or event type");
    }

    logger.info({ eventId, eventType }, "Razorpay webhook received");

    const payloadHash = crypto.createHash("sha256").update(rawBody).digest("hex");
    const isFirstDelivery = await subscriptionRepository.markWebhookEventProcessed(
      eventId,
      eventType,
      payloadHash,
    );

    if (!isFirstDelivery) {
      logger.info({ eventId, eventType }, "Duplicate Razorpay webhook ignored");
      return {
        processed: true,
        duplicate: true,
        eventId,
        eventType,
      };
    }

    const supportedEvents = new Set([
      "payment.captured",
      "payment.failed",
      "order.paid",
      "refund.processed",
    ]);

    if (!supportedEvents.has(eventType)) {
      return {
        processed: false,
        duplicate: false,
        eventId,
        eventType,
        reason: "Unsupported event",
      };
    }

    // Intentionally no subscription activation logic here yet.
    return {
      processed: true,
      duplicate: false,
      eventId,
      eventType,
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
      `SUBSCRIPTION_LIMIT_REACHED:${key}:${nextUsageValue}:${limit}:upgrade_required:${DEFAULT_PRO_PLAN_CODE}`,
    );
  },
};
