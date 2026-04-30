import { z } from "zod";
import { AVAILABILITY_STATUSES } from "../types/domain";

export const setAvailabilitySchema = z.object({
  body: z.object({
    vendorId: z.string().min(24).max(24).optional(),
    date: z.coerce.date(),
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
