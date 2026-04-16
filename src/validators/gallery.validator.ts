import { z } from "zod";

export const createGallerySchema = z.object({
  body: z.object({
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
  }),
  query: z.object({}),
  params: z.object({}),
});

export const listGallerySchema = z.object({
  body: z.object({}).default({}),
  query: z
    .object({
      category: z.string().optional(),
      vendorId: z.string().optional(),
      sourceType: z.enum(["admin", "vendor"]).optional(),
      limit: z.coerce.number().int().min(1).max(120).optional(),
    })
    .default({}),
  params: z.object({}).default({}),
});
