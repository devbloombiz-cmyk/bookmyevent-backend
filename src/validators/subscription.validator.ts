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

export const adminListSubscriptionRequestsSchema = z.object({
  body: z.object({}).default({}),
  query: z.object({
    status: z.enum(["inactive", "pending_payment", "active", "expired", "cancelled"]).optional(),
    paymentStatus: z.enum(["pending", "confirmed", "failed"]).optional(),
    actorType: z.enum(["vendor", "venue_owner"]).optional(),
    planCode: z.enum(["FREE", "PRO_YEARLY_4999"]).optional(),
    limit: z.coerce.number().int().min(1).max(300).optional(),
  }),
  params: z.object({}).default({}),
});

export const subscriptionRazorpayWebhookSchema = z.object({
  body: z.record(z.string(), z.unknown()),
  query: z.object({}).default({}),
  params: z.object({}).default({}),
});
