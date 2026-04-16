import { z } from "zod";
import { BOOKING_STATUSES, PAYMENT_STATUSES } from "../types/domain";

export const bookingCreateSchema = z.object({
  body: z.object({
    customerId: z.string().min(24).max(24),
    vendorId: z.string().min(24).max(24),
    packageId: z.string().min(24).max(24),
    eventDate: z.coerce.date(),
    amount: z.number().nonnegative(),
    advancePaid: z.number().nonnegative().default(0),
    paymentStatus: z.enum(PAYMENT_STATUSES).default("pending"),
    bookingStatus: z.enum(BOOKING_STATUSES).default("initiated"),
  }),
  query: z.object({}),
  params: z.object({}),
});
