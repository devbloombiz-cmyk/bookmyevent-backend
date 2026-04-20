import { z } from "zod";
import { BOOKING_STATUSES, PAYMENT_STATUSES } from "../types/domain";

export const bookingCreateSchema = z.object({
  body: z.object({
    customerId: z.string().min(24).max(24),
    vendorId: z.string().min(24).max(24),
    packageId: z.string().min(24).max(24),
    eventDate: z.coerce.date(),
    eventSlot: z.string().optional().default("Full Day"),
    amount: z.number().nonnegative(),
    advancePaid: z.number().nonnegative().default(0),
    paymentStatus: z.enum(PAYMENT_STATUSES).default("pending"),
    bookingStatus: z.enum(BOOKING_STATUSES).default("initiated"),
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
      advancePaid: z.number().nonnegative().optional(),
      amount: z.number().nonnegative().optional(),
      eventDate: z.coerce.date().optional(),
      eventSlot: z.string().optional(),
    })
    .refine((payload) => Object.keys(payload).length > 0, "At least one field is required"),
  query: z.object({}),
  params: z.object({
    bookingId: z.string().min(1),
  }),
});
