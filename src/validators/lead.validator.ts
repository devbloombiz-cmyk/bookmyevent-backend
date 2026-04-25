import { z } from "zod";
import { LEAD_STATUSES, PAYMENT_STATUSES } from "../types/domain";

export const createLeadSchema = z.object({
  body: z.object({
    customerId: z.string().min(24).max(24).optional(),
    vendorId: z.string().min(24).max(24),
    eventDate: z.coerce.date(),
    eventSlot: z.string().optional().default("Full Day"),
    location: z.string().min(2),
    message: z.string().default(""),
    status: z.enum(LEAD_STATUSES).default("NEW"),
    quoteAmount: z.number().nonnegative().default(0),
    paymentLink: z.string().default(""),
    paymentStatus: z.enum(PAYMENT_STATUSES).default("pending"),
  }),
  query: z.object({}),
  params: z.object({}),
});

export const listLeadSchema = z.object({
  body: z.object({}).default({}),
  query: z.object({
    vendorId: z.string().optional(),
    status: z.enum(LEAD_STATUSES).optional(),
  }),
  params: z.object({}).default({}),
});

export const updateLeadSchema = z.object({
  body: z
    .object({
      eventDate: z.coerce.date().optional(),
      eventSlot: z.string().optional(),
      location: z.string().min(2).optional(),
      message: z.string().optional(),
      status: z.enum(LEAD_STATUSES).optional(),
      quoteAmount: z.number().nonnegative().optional(),
      paymentLink: z.string().optional(),
      paymentStatus: z.enum(PAYMENT_STATUSES).optional(),
    })
    .refine((payload) => Object.keys(payload).length > 0, "At least one field is required"),
  query: z.object({}),
  params: z.object({
    leadId: z.string().min(1),
  }),
});

export const convertLeadToBookingSchema = z.object({
  body: z.object({
    packageId: z.string().min(24).max(24),
    amount: z.number().nonnegative(),
    advancePaid: z.number().nonnegative().default(0),
  }),
  query: z.object({}),
  params: z.object({
    leadId: z.string().min(1),
  }),
});
