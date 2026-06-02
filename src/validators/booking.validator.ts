import { z } from "zod";
import { BOOKING_STATUSES, PAYMENT_STATUSES } from "../types/domain";

const SETTLEMENT_STATUSES = ["PENDING", "SETTLED"] as const;

export const bookingCreateSchema = z.object({
  body: z.object({
    customerId: z.string().min(24).max(24).optional(),
    vendorId: z.string().min(24).max(24),
    packageId: z.string().min(24).max(24),
    eventDate: z.coerce.date(),
    eventSlot: z.string().optional().default("Full Day"),
    amount: z.number().nonnegative(),
    advancePaid: z.number().nonnegative().default(0),
    paidAmount: z.number().nonnegative().optional(),
    dueAmount: z.number().nonnegative().optional(),
    paymentStatus: z.enum(PAYMENT_STATUSES).default("pending"),
    bookingStatus: z.enum(BOOKING_STATUSES).default("upcoming"),
  }),
  query: z.object({}),
  params: z.object({}),
});

export const bookingListSchema = z.object({
  body: z.object({}).default({}),
  query: z.object({
    vendorId: z.string().optional(),
    bookingStatus: z.enum(BOOKING_STATUSES).optional(),
    paymentStatus: z.enum(PAYMENT_STATUSES).optional(),
  }),
  params: z.object({}).default({}),
});

export const bookingUpdateSchema = z.object({
  body: z
    .object({
      bookingStatus: z.enum(BOOKING_STATUSES).optional(),
      paymentStatus: z.enum(PAYMENT_STATUSES).optional(),
      settlementStatus: z.enum(SETTLEMENT_STATUSES).optional(),
      advancePaid: z.number().nonnegative().optional(),
      paidAmount: z.number().nonnegative().optional(),
      dueAmount: z.number().nonnegative().optional(),
      amount: z.number().nonnegative().optional(),
      settledAmount: z.number().nonnegative().optional(),
      pendingSettlement: z.number().nonnegative().optional(),
      eventDate: z.coerce.date().optional(),
      eventSlot: z.string().optional(),
    })
    .refine((payload) => Object.keys(payload).length > 0, "At least one field is required"),
  query: z.object({}),
  params: z.object({
    bookingId: z.string().min(1),
  }),
});

export const bookingBalanceRequestSchema = z.object({
  body: z.object({
    amount: z.number().positive(),
    paymentType: z.enum(["BALANCE", "EXTRA"]).optional().default("BALANCE"),
    notes: z.string().optional(),
    paymentExpiry: z.string().optional(),
    sendWhatsApp: z.boolean().optional().default(false),
    customerMobile: z.string().min(8).max(20).optional(),
  }),
  query: z.object({}),
  params: z.object({
    bookingId: z.string().min(1),
  }),
});

export const bookingBalanceSendSchema = z.object({
  body: z.object({
    notes: z.string().optional(),
  }),
  query: z.object({}),
  params: z.object({
    bookingId: z.string().min(1),
    paymentRequestId: z.string().min(1),
  }),
});

export const bookingManualPaymentSchema = z.object({
  body: z.object({
    amount: z.number().positive(),
    paymentType: z.enum(["BALANCE", "EXTRA"]).optional().default("BALANCE"),
    notes: z.string().optional(),
  }),
  query: z.object({}),
  params: z.object({
    bookingId: z.string().min(1),
  }),
});

export const bookingReferralVendorListSchema = z.object({
  body: z.object({}).default({}),
  query: z.object({}),
  params: z.object({}).default({}),
});

export const bookingReferralAdminListSchema = z.object({
  body: z.object({}).default({}),
  query: z.object({
    limit: z.coerce.number().int().min(1).max(500).optional(),
  }),
  params: z.object({}).default({}),
});
