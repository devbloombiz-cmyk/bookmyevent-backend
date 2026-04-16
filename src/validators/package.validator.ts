import { z } from "zod";

export const createVendorPackageSchema = z.object({
  body: z.object({
    vendorId: z.string().min(24).max(24),
    title: z.string().min(2),
    description: z.string().default(""),
    price: z.number().nonnegative(),
    inclusions: z.array(z.string()).default([]),
  }),
  query: z.object({}),
  params: z.object({}),
});

export const createPlatformPackageSchema = z.object({
  body: z.object({
    title: z.string().min(2),
    description: z.string().default(""),
    basePrice: z.number().nonnegative(),
    category: z.string().min(2),
    inclusions: z.array(z.string()).default([]),
  }),
  query: z.object({}),
  params: z.object({}),
});
