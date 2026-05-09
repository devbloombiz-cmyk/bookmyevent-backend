import { subscriptionService } from "../services/subscription.service";
import { sendSuccess } from "../utils/api-response";
import { asyncHandler } from "../utils/async-handler";
import { ApiError } from "../utils/api-error";

export const subscriptionController = {
  getMyOverview: asyncHandler(async (req, res) => {
    const authUser = req.authUser;
    if (!authUser) {
      return sendSuccess(res, "Unauthorized", { subscription: null }, 401);
    }

    const overview = await subscriptionService.getMySubscriptionOverview({
      id: authUser.id,
      role: authUser.role,
    });
    return sendSuccess(res, "Subscription overview fetched", { subscription: overview });
  }),
  listMyPlans: asyncHandler(async (req, res) => {
    const authUser = req.authUser;
    if (!authUser) {
      return sendSuccess(res, "Unauthorized", { plans: [] }, 401);
    }

    const plans = await subscriptionService.listMyEligiblePlans({
      id: authUser.id,
      role: authUser.role,
    });
    return sendSuccess(res, "Subscription plans fetched", { plans });
  }),
  createMyCheckoutIntent: asyncHandler(async (req, res) => {
    const authUser = req.authUser;
    if (!authUser) {
      return sendSuccess(res, "Unauthorized", { subscription: null }, 401);
    }

    const result = await subscriptionService.createCheckoutIntent(
      {
        id: authUser.id,
        role: authUser.role,
      },
      {
        planCode: req.body.planCode,
        paymentProvider: req.body.paymentProvider,
        paymentReference: req.body.paymentReference,
      },
    );

    return sendSuccess(res, "Subscription checkout intent created", result, 201);
  }),
  confirmMyRazorpayPayment: asyncHandler(async (req, res) => {
    const authUser = req.authUser;
    if (!authUser) {
      return sendSuccess(res, "Unauthorized", { subscription: null }, 401);
    }

    const body = req.body as Record<string, unknown>;

    const subscription = await subscriptionService.confirmMyRazorpayPayment(
      {
        id: authUser.id,
        role: authUser.role,
      },
      {
        subscriptionId: String(body.subscriptionId || "").trim(),
        razorpayOrderId: String(body.razorpayOrderId || body.razorpay_order_id || "").trim(),
        razorpayPaymentId: String(body.razorpayPaymentId || body.razorpay_payment_id || "").trim(),
        razorpaySignature: String(body.razorpaySignature || body.razorpay_signature || "").trim(),
      },
    );

    return sendSuccess(res, "Razorpay payment confirmed", { subscription });
  }),
  confirmPaymentByAdmin: asyncHandler(async (req, res) => {
    const authUser = req.authUser;
    if (!authUser) {
      return sendSuccess(res, "Unauthorized", { subscription: null }, 401);
    }

    const subscriptionId = String(req.params.subscriptionId);
    const subscription = await subscriptionService.confirmPaymentByAdmin(subscriptionId, req.body, authUser.id);
    return sendSuccess(res, "Subscription payment confirmed", { subscription });
  }),
  listSubscriptionsByAdmin: asyncHandler(async (req, res) => {
    const subscriptions = await subscriptionService.listSubscriptionsForAdmin({
      status: req.query.status as
        | "inactive"
        | "pending_payment"
        | "active"
        | "expired"
        | "cancelled"
        | undefined,
      paymentStatus: req.query.paymentStatus as "pending" | "confirmed" | "failed" | undefined,
      actorType: req.query.actorType as "vendor" | "venue_owner" | undefined,
      planCode: req.query.planCode as "FREE" | "PRO_YEARLY_4999" | undefined,
      limit: typeof req.query.limit === "number" ? req.query.limit : undefined,
    });

    return sendSuccess(res, "Subscription requests fetched", { subscriptions });
  }),
  razorpayWebhook: asyncHandler(async (req, res) => {
    const rawBody = Buffer.isBuffer(req.body) ? req.body : null;
    if (!rawBody) {
      throw new ApiError(400, "Webhook endpoint requires raw request body");
    }

    const signatureHeader = String(req.headers["x-razorpay-signature"] || "");
    const result = await subscriptionService.processRazorpayWebhook(rawBody, signatureHeader);
    return res.status(200).json({ success: true, message: "Razorpay webhook received", data: { result } });
  }),
};
