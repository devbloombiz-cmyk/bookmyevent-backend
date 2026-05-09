import { z } from "zod";

const actorAccessSchema = z.object({
  body: z.object({}).default({}),
  query: z.object({}).default({}),
  params: z.object({}).default({}),
});

export const getMySubscriptionSchema = actorAccessSchema;
export const listMySubscriptionPlansSchema = actorAccessSchema;

export const createSubscriptionCheckoutIntentSchema = z.object({
  body: z.object({
    planCode: z.enum(["PRO_YEARLY_4999"]),
    paymentProvider: z.enum(["manual", "razorpay"]).optional().default("manual"),
    paymentReference: z.string().optional().default(""),
  }),
  query: z.object({}).default({}),
  params: z.object({}).default({}),
});

export const adminConfirmSubscriptionPaymentSchema = z.object({
  body: z.object({
    paymentReference: z.string().optional().default(""),
    providerPaymentId: z.string().optional().default(""),
    providerOrderId: z.string().optional().default(""),
    providerSignature: z.string().optional().default(""),
    amountInr: z.number().min(0).optional(),
  }),
  query: z.object({}).default({}),
  params: z.object({
    subscriptionId: z.string().min(1),
  }),
});

export const confirmMyRazorpayPaymentSchema = z.object({
  body: z
    .object({
      subscriptionId: z.string().min(1),
      razorpayOrderId: z.string().optional(),
      razorpayPaymentId: z.string().optional(),
      razorpaySignature: z.string().optional(),
      razorpay_order_id: z.string().optional(),
      razorpay_payment_id: z.string().optional(),
      razorpay_signature: z.string().optional(),
    })
    .superRefine((body, ctx) => {
      if (!(body.razorpayOrderId || body.razorpay_order_id)) {
        ctx.addIssue({ code: "custom", message: "razorpayOrderId is required", path: ["razorpayOrderId"] });
      }
      if (!(body.razorpayPaymentId || body.razorpay_payment_id)) {
        ctx.addIssue({ code: "custom", message: "razorpayPaymentId is required", path: ["razorpayPaymentId"] });
      }
      if (!(body.razorpaySignature || body.razorpay_signature)) {
        ctx.addIssue({ code: "custom", message: "razorpaySignature is required", path: ["razorpaySignature"] });
      }
    }),
  query: z.object({}).default({}),
  params: z.object({}).default({}),
});

export const adminListSubscriptionRequestsSchema = z.object({
  body: z.object({}).default({}),
  query: z.object({
    status: z.enum(["inactive", "pending_payment", "active", "expired", "cancelled"]).optional(),
    paymentStatus: z.enum(["pending", "confirmed", "failed"]).optional(),
    actorType: z.enum(["vendor", "venue_owner"]).optional(),
    planCode: z.enum(["FREE", "PRO_YEARLY_4999"]).optional(),
    page: z.coerce.number().int().min(1).optional(),
    limit: z.coerce.number().int().min(1).max(300).optional(),
  }),
  params: z.object({}).default({}),
});

export const subscriptionRazorpayWebhookSchema = z.object({
  body: z.record(z.string(), z.unknown()),
  query: z.object({}).default({}),
  params: z.object({}).default({}),
});
