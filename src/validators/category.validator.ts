import { z } from "zod";

const optionalUrl = z.union([z.url(), z.literal("")]).optional().default("");

const subCategorySchema = z.object({
  name: z.string().min(2),
  displayName: z.string().optional(),
  image: optionalUrl,
  isActive: z.boolean().default(true),
});

const categoryBodySchema = z.object({
  name: z.string().min(2),
  displayName: z.string().min(2).optional(),
  description: z.string().optional().default(""),
  icon: z.string().optional().default(""),
  coverImage: optionalUrl,
  isFeatured: z.boolean().optional().default(false),
  subCategories: z.array(subCategorySchema).default([]),
  isActive: z.boolean().optional(),
});

export const categoryCreateSchema = z.object({
  body: categoryBodySchema,
  query: z.object({}),
  params: z.object({}),
});

export const categoryUpdateSchema = z.object({
  body: categoryBodySchema.partial(),
  query: z.object({}),
  params: z.object({
    categoryId: z.string().min(1),
  }),
});

export const categoryDeleteSchema = z.object({
  body: z.object({}).optional().default({}),
  query: z.object({}),
  params: z.object({
    categoryId: z.string().min(1),
  }),
});

export const subCategoryBulkCreateSchema = z.object({
  body: z.object({
    subCategories: z.array(subCategorySchema).min(1),
  }),
  query: z.object({}),
  params: z.object({
    categoryId: z.string().min(1),
  }),
});

export const subCategoryUpdateSchema = z.object({
  body: subCategorySchema.partial(),
  query: z.object({}),
  params: z.object({
    categoryId: z.string().min(1),
    subCategoryId: z.string().min(1),
  }),
});

export const subCategoryDeleteSchema = z.object({
  body: z.object({}).optional().default({}),
  query: z.object({}),
  params: z.object({
    categoryId: z.string().min(1),
    subCategoryId: z.string().min(1),
  }),
});
