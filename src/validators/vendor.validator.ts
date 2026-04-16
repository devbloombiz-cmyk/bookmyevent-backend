import { z } from "zod";

export const vendorCreateSchema = z.object({
  body: z.object({
    businessName: z.string().min(2),
    ownerName: z.string().min(2),
    email: z.email(),
    mobile: z.string().min(8).max(20),
    category: z.string().min(2),
    subCategory: z.string().min(2),
    state: z.string().optional().default(""),
    district: z.string().optional().default(""),
    city: z.string().min(2),
    serviceZones: z.array(z.string()).default([]),
    description: z.string().default(""),
    portfolioImages: z.array(z.url()).default([]),
  }),
  query: z.object({}),
  params: z.object({}),
});

export const vendorListSchema = z.object({
  body: z.object({}).default({}),
  query: z.object({
    category: z.string().min(2).optional(),
    subCategory: z.string().min(2).optional(),
    state: z.string().min(2).optional(),
    district: z.string().min(2).optional(),
    city: z.string().min(2).optional(),
    isVerified: z
      .enum(["true", "false"])
      .optional()
      .transform((value) => (value ? value === "true" : undefined)),
    limit: z.coerce.number().int().min(1).max(100).optional(),
  }),
  params: z.object({}).default({}),
});
