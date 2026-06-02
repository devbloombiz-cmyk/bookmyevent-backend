import { z } from "zod";

const withdrawalStatusEnum = z.enum(["PENDING", "APPROVED", "REJECTED", "TRANSFERRED"]);

export const paymentHistoryListSchema = z.object({
  body: z.object({}).default({}),
  query: z.object({
    limit: z.coerce.number().int().min(1).max(1000).optional(),
  }),
  params: z.object({}).default({}),
});

export const createWithdrawalRequestSchema = z.object({
  body: z.object({
    paymentSelections: z
      .array(
        z.object({
          paymentRequestId: z.string().min(1),
          amount: z.coerce.number().positive(),
        }),
      )
      .min(1),
    requestNote: z.string().max(500).optional(),
  }),
  query: z.object({}).default({}),
  params: z.object({}).default({}),
});

export const listWithdrawalRequestsSchema = z.object({
  body: z.object({}).default({}),
  query: z.object({
    limit: z.coerce.number().int().min(1).max(500).optional(),
    status: withdrawalStatusEnum.optional(),
    vendorId: z.string().min(1).optional(),
    ownerType: z.enum(["vendor", "venue_owner"]).optional(),
  }),
  params: z.object({}).default({}),
});

export const updateWithdrawalRequestStatusSchema = z.object({
  body: z.object({
    action: z.enum(["approve", "reject", "mark_transferred"]),
    note: z.string().max(500).optional(),
    transferReference: z.string().max(120).optional(),
    transferredAt: z.string().optional(),
  }),
  query: z.object({}).default({}),
  params: z.object({
    withdrawalRequestId: z.string().min(1),
  }),
});
