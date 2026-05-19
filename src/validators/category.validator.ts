import { z } from "zod";

const optionalUrl = z.union([z.url(), z.literal("")]).optional();

const subCategoryCreateSchema = z.object({
  name: z.string().min(2),
  displayName: z.string().optional(),
  image: optionalUrl,
  isActive: z.boolean().default(true),
});

const subCategoryUpdateBodySchema = z.object({
  name: z.string().min(2).optional(),
  displayName: z.string().optional(),
  image: optionalUrl,
  isActive: z.boolean().optional(),
});

const categoryCreateBodySchema = z.object({
  name: z.string().min(2),
  displayName: z.string().min(2).optional(),
  description: z.string().optional().default(""),
  icon: z.string().optional().default(""),
  coverImage: optionalUrl,
  isFeatured: z.boolean().optional().default(false),
  subCategories: z.array(subCategoryCreateSchema).default([]),
  isActive: z.boolean().optional().default(true),
});

const categoryUpdateBodySchema = z.object({
  name: z.string().min(2).optional(),
  displayName: z.string().min(2).optional(),
  description: z.string().optional(),
  icon: z.string().optional(),
  coverImage: optionalUrl,
  isFeatured: z.boolean().optional(),
  subCategories: z.array(subCategoryUpdateBodySchema).optional(),
  isActive: z.boolean().optional(),
});

export const categoryCreateSchema = z.object({
  body: categoryCreateBodySchema,
  query: z.object({}),
  params: z.object({}),
});

export const categoryUpdateSchema = z.object({
  body: categoryUpdateBodySchema,
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
    subCategories: z.array(subCategoryCreateSchema).min(1),
  }),
  query: z.object({}),
  params: z.object({
    categoryId: z.string().min(1),
  }),
});

export const subCategoryUpdateSchema = z.object({
  body: subCategoryUpdateBodySchema,
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
