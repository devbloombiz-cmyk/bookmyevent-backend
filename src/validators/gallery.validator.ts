import { z } from "zod";

const galleryBodySchema = z.object({
  title: z.string().min(2),
  category: z.string().min(2),
  subCategory: z.string().optional().default(""),
  mediaType: z.enum(["image", "video"]).default("image"),
  mediaUrl: z.url(),
  thumbnailUrl: z.url().optional().default(""),
  sourceType: z.enum(["admin", "vendor"]).default("admin"),
  vendorId: z.string().optional().default(""),
  location: z.string().optional().default(""),
  isFeatured: z.boolean().optional().default(false),
  isActive: z.boolean().optional(),
});

export const createGallerySchema = z.object({
  body: galleryBodySchema,
  query: z.object({}),
  params: z.object({}),
});

export const updateGallerySchema = z.object({
  body: galleryBodySchema
    .partial()
    .refine((payload) => Object.keys(payload).length > 0, "At least one field is required"),
  query: z.object({}),
  params: z.object({
    galleryId: z.string().min(1),
  }),
});

export const deleteGallerySchema = z.object({
  body: z.object({}).optional().default({}),
  query: z.object({}),
  params: z.object({
    galleryId: z.string().min(1),
  }),
});

export const listGallerySchema = z.object({
  body: z.object({}).default({}),
  query: z.object({
    category: z.string().optional(),
    vendorId: z.string().optional(),
    sourceType: z.enum(["admin", "vendor"]).optional(),
    includeInactive: z
      .enum(["true", "false"])
      .optional()
      .transform((value) => (value ? value === "true" : undefined)),
    limit: z.coerce.number().int().min(1).max(120).optional(),
  }),
  params: z.object({}).default({}),
});
