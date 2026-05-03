import { z } from "zod";

const optionalUrl = z.union([z.url(), z.literal("")]).optional().default("");

const blogBodySchema = z.object({
  title: z.string().min(3),
  slug: z.string().min(3).optional(),
  excerpt: z.string().optional().default(""),
  content: z.string().optional().default(""),
  coverImage: optionalUrl,
  tags: z.array(z.string().min(1)).optional().default([]),
  isFeatured: z.boolean().optional().default(false),
  isActive: z.boolean().optional().default(true),
  publishedAt: z.string().optional(),
});

export const createBlogSchema = z.object({
  body: blogBodySchema,
  query: z.object({}),
  params: z.object({}),
});

export const listBlogSchema = z.object({
  body: z.object({}).default({}),
  query: z.object({
    includeInactive: z.enum(["true", "false"]).optional(),
    search: z.string().min(1).optional(),
    isFeatured: z.enum(["true", "false"]).optional(),
    limit: z.coerce.number().int().min(1).max(100).optional(),
  }),
  params: z.object({}).default({}),
});

export const blogBySlugSchema = z.object({
  body: z.object({}).optional().default({}),
  query: z.object({ includeInactive: z.enum(["true", "false"]).optional() }),
  params: z.object({ slug: z.string().min(1) }),
});

export const updateBlogSchema = z.object({
  body: blogBodySchema.partial().refine((payload) => Object.keys(payload).length > 0, "At least one field is required"),
  query: z.object({}),
  params: z.object({ blogId: z.string().min(1) }),
});

export const deleteBlogSchema = z.object({
  body: z.object({}).optional().default({}),
  query: z.object({}),
  params: z.object({ blogId: z.string().min(1) }),
});
