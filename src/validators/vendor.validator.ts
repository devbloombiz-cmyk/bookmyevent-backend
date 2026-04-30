import { z } from "zod";

const socialLinksSchema = z
  .object({
    facebook: z.union([z.url(), z.literal("")]).optional().default(""),
    instagram: z.union([z.url(), z.literal("")]).optional().default(""),
    youtube: z.union([z.url(), z.literal("")]).optional().default(""),
  })
  .optional()
  .default({
    facebook: "",
    instagram: "",
    youtube: "",
  });

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
    locationDisplayName: z.string().optional().default(""),
    locationInputMode: z.enum(["collection", "manual"]).optional().default("collection"),
    serviceZones: z.array(z.string()).default([]),
    socialLinks: socialLinksSchema,
    description: z.string().default(""),
    paymentTerms: z.string().optional().default(""),
    travelCost: z.string().optional().default(""),
    deliveryTime: z.string().optional().default(""),
    pricingModel: z.enum(["base_package", "per_day", "per_plate"]).optional().default("base_package"),
    pricingAmount: z.number().min(0).optional().default(0),
    approvalStatus: z.enum(["pending", "active", "disabled"]).optional().default("active"),
    portfolioImages: z.array(z.url()).default([]),
    isVerified: z.boolean().optional().default(false),
    isActive: z.boolean().optional().default(true),
  }),
  query: z.object({}),
  params: z.object({}),
});

export const vendorUpdateSchema = z.object({
  body: z
    .object({
      businessName: z.string().min(2).optional(),
      ownerName: z.string().min(2).optional(),
      email: z.email().optional(),
      mobile: z.string().min(8).max(20).optional(),
      category: z.string().min(2).optional(),
      subCategory: z.string().min(2).optional(),
      state: z.string().optional(),
      district: z.string().optional(),
      city: z.string().min(2).optional(),
      locationDisplayName: z.string().optional(),
      locationInputMode: z.enum(["collection", "manual"]).optional(),
      serviceZones: z.array(z.string()).optional(),
      socialLinks: socialLinksSchema,
      description: z.string().optional(),
      paymentTerms: z.string().optional(),
      travelCost: z.string().optional(),
      deliveryTime: z.string().optional(),
      pricingModel: z.enum(["base_package", "per_day", "per_plate"]).optional(),
      pricingAmount: z.number().min(0).optional(),
      approvalStatus: z.enum(["pending", "active", "disabled"]).optional(),
      portfolioImages: z.array(z.url()).optional(),
      isVerified: z.boolean().optional(),
      isActive: z.boolean().optional(),
    })
    .refine((payload) => Object.keys(payload).length > 0, "At least one field is required"),
  query: z.object({}),
  params: z.object({
    vendorId: z.string().min(1),
  }),
});

export const vendorDeleteSchema = z.object({
  body: z.object({}).optional().default({}),
  query: z.object({}),
  params: z.object({
    vendorId: z.string().min(1),
  }),
});

export const vendorSelfUpdateSchema = z.object({
  body: z
    .object({
      businessName: z.string().min(2).optional(),
      ownerName: z.string().min(2).optional(),
      email: z.email().optional(),
      mobile: z.string().min(8).max(20).optional(),
      category: z.string().min(2).optional(),
      subCategory: z.string().min(2).optional(),
      state: z.string().optional(),
      district: z.string().optional(),
      city: z.string().min(2).optional(),
      locationDisplayName: z.string().optional(),
      locationInputMode: z.enum(["collection", "manual"]).optional(),
      serviceZones: z.array(z.string()).optional(),
      socialLinks: socialLinksSchema,
      description: z.string().optional(),
      paymentTerms: z.string().optional(),
      travelCost: z.string().optional(),
      deliveryTime: z.string().optional(),
      pricingModel: z.enum(["base_package", "per_day", "per_plate"]).optional(),
      pricingAmount: z.number().min(0).optional(),
      portfolioImages: z.array(z.url()).optional(),
    })
    .refine((payload) => Object.keys(payload).length > 0, "At least one field is required"),
  query: z.object({}),
  params: z.object({}).default({}),
});

export const vendorListSchema = z.object({
  body: z.object({}).default({}),
  query: z.object({
    category: z.string().min(2).optional(),
    subCategory: z.string().min(2).optional(),
    search: z.string().min(1).optional(),
    state: z.string().min(2).optional(),
    district: z.string().min(2).optional(),
    city: z.string().min(2).optional(),
    approvalStatus: z
      .enum(["pending", "active", "disabled"])
      .optional()
      .transform((value) => value ?? undefined),
    isVerified: z
      .enum(["true", "false"])
      .optional()
      .transform((value) => (value ? value === "true" : undefined)),
    includeInactive: z
      .enum(["true", "false"])
      .optional()
      .transform((value) => (value ? value === "true" : undefined)),
    limit: z.coerce.number().int().min(1).max(100).optional(),
  }),
  params: z.object({}).default({}),
});
