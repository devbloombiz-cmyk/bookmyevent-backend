import { z } from "zod";
import { LEAD_STATUSES, PAYMENT_STATUSES } from "../types/domain";

export const createLeadSchema = z.object({
  body: z.object({
    customerId: z.string().min(24).max(24),
    vendorId: z.string().min(24).max(24),
    eventDate: z.coerce.date(),
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
