import { z } from "zod";
import { AVAILABILITY_STATUSES } from "../types/domain";

export const setAvailabilitySchema = z.object({
  body: z.object({
    vendorId: z.string().min(24).max(24),
    date: z.coerce.date(),
    slot: z.string().min(2),
    status: z.enum(AVAILABILITY_STATUSES),
  }),
  query: z.object({}),
  params: z.object({}),
});
