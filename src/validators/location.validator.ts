import { z } from "zod";

export const createLocationSchema = z.object({
  body: z.object({
    state: z.string().min(2).default("Kerala"),
    district: z.string().min(2),
    city: z.string().min(2),
    districtImageUrl: z.union([z.url(), z.literal("")]).optional().default(""),
  }),
  query: z.object({}),
  params: z.object({}),
});

export const updateLocationEntrySchema = z.object({
  body: z.object({
    state: z.string().min(2),
    district: z.string().min(2),
    city: z.string().min(2),
    nextState: z.string().min(2),
    nextDistrict: z.string().min(2),
    nextCity: z.string().min(2),
    districtImageUrl: z.union([z.url(), z.literal("")]).optional().default(""),
  }),
  query: z.object({}),
  params: z.object({}),
});

export const deleteLocationEntrySchema = z.object({
  body: z.object({
    state: z.string().min(2),
    district: z.string().min(2),
    city: z.string().min(2),
  }),
  query: z.object({}),
  params: z.object({}),
});

export const listLocationSchema = z.object({
  body: z.object({}).default({}),
  query: z.object({
    includeInactive: z
      .enum(["true", "false"])
      .optional()
      .transform((value) => (value ? value === "true" : undefined)),
  }),
  params: z.object({}).default({}),
});
