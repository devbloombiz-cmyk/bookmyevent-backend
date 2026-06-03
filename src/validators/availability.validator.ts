import { z } from "zod";
import { AVAILABILITY_STATUSES } from "../types/domain";

function isTodayOrFuture(value: Date) {
  const selectedDate = new Date(value);
  selectedDate.setHours(0, 0, 0, 0);

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  return selectedDate.getTime() >= today.getTime();
}

export const setAvailabilitySchema = z.object({
  body: z.object({
    vendorId: z.string().min(24).max(24).optional(),
    date: z.coerce.date().refine(isTodayOrFuture, {
      message: "Past dates cannot be updated",
    }),
    slot: z.string().min(2),
    status: z.enum(AVAILABILITY_STATUSES),
  }),
  query: z.object({}),
  params: z.object({}),
});

export const listAvailabilitySchema = z.object({
  body: z.object({}).default({}),
  query: z.object({
    vendorId: z.string().optional(),
  }),
  params: z.object({}).default({}),
});

export const listAvailabilityByDateSchema = z.object({
  body: z.object({}).default({}),
  query: z.object({
    date: z.coerce.date(),
  }),
  params: z.object({}).default({}),
});

export const checkBookingAvailabilitySchema = z.object({
  body: z.object({}).default({}),
  query: z.object({
    vendorId: z.string().min(24).max(24),
    packageId: z.string().min(24).max(24),
    eventDate: z.coerce.date(),
    venueOwnerId: z.string().min(24).max(24).optional(),
    customerId: z.string().min(24).max(24).optional(),
    customerMobile: z.string().max(20).optional(),
  }),
  params: z.object({}).default({}),
});
