import { z } from "zod";

const baseVendorPackageSchema = z.object({
  vendorId: z.string().min(24).max(24).optional(),
  title: z.string().min(2),
  description: z.string().default(""),
  price: z.number().nonnegative(),
  duration: z.string().max(120).optional().default(""),
  inclusions: z.array(z.string()).default([]),
  features: z.array(z.string()).default([]),
  coverImage: z.string().optional().default(""),
  isActive: z.boolean().optional(),
});

const basePlatformPackageSchema = z.object({
  title: z.string().min(2),
  description: z.string().default(""),
  basePrice: z.number().nonnegative(),
  category: z.string().min(2),
  inclusions: z.array(z.string()).default([]),
  isActive: z.boolean().optional(),
});

export const createVendorPackageSchema = z.object({
  body: baseVendorPackageSchema,
  query: z.object({}),
  params: z.object({}),
});

export const createPlatformPackageSchema = z.object({
  body: basePlatformPackageSchema,
  query: z.object({}),
  params: z.object({}),
});

export const updateVendorPackageSchema = z.object({
  body: baseVendorPackageSchema
    .partial()
    .refine((payload) => Object.keys(payload).length > 0, "At least one field is required"),
  query: z.object({}),
  params: z.object({
    packageId: z.string().min(1),
  }),
});

export const updatePlatformPackageSchema = z.object({
  body: basePlatformPackageSchema
    .partial()
    .refine((payload) => Object.keys(payload).length > 0, "At least one field is required"),
  query: z.object({}),
  params: z.object({
    packageId: z.string().min(1),
  }),
});

export const deletePackageSchema = z.object({
  body: z.object({}).optional().default({}),
  query: z.object({}),
  params: z.object({
    packageId: z.string().min(1),
  }),
});

export const listVendorPackageSchema = z.object({
  body: z.object({}).default({}),
  query: z.object({
    vendorId: z.string().optional(),
    includeInactive: z
      .enum(["true", "false"])
      .optional()
      .transform((value) => (value ? value === "true" : undefined)),
  }),
  params: z.object({}).default({}),
});

export const listPlatformPackageSchema = z.object({
  body: z.object({}).default({}),
  query: z.object({
    includeInactive: z
      .enum(["true", "false"])
      .optional()
      .transform((value) => (value ? value === "true" : undefined)),
  }),
  params: z.object({}).default({}),
});
