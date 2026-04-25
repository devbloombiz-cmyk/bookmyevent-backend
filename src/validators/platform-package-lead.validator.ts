import { z } from "zod";

const packageLeadStatuses = ["new", "contacted", "closed"] as const;

export const createPlatformPackageLeadSchema = z.object({
  body: z.object({
    packageId: z.string().min(24).max(24),
    name: z.string().min(2),
    mobile: z.string().min(8).max(20),
    email: z.union([z.email(), z.literal("")]).optional().default(""),
    eventDate: z.coerce.date().optional(),
    message: z.string().optional().default(""),
  }),
  query: z.object({}),
  params: z.object({}),
});

export const listPlatformPackageLeadSchema = z.object({
  body: z.object({}).default({}),
  query: z.object({
    status: z.enum(packageLeadStatuses).optional(),
  }),
  params: z.object({}).default({}),
});

export const updatePlatformPackageLeadSchema = z.object({
  body: z
    .object({
      status: z.enum(packageLeadStatuses).optional(),
      message: z.string().optional(),
    })
    .refine((payload) => Object.keys(payload).length > 0, "At least one field is required"),
  query: z.object({}),
  params: z.object({
    leadId: z.string().min(1),
  }),
});
