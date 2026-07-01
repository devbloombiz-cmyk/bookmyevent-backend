import { z } from "zod";

const subjectTypeSchema = z.enum(["vendor", "venue_owner"]);

export const reviewCreateSchema = z.object({
  body: z.object({
    bookingId: z.string().min(24).max(24),
    rating: z.number().int().min(1).max(5),
    title: z.string().trim().min(3).max(120),
    message: z.string().trim().min(10).max(2000),
  }),
  query: z.object({}).default({}),
  params: z.object({}).default({}),
});

export const reviewPublicListSchema = z.object({
  body: z.object({}).default({}),
  query: z.object({
    subjectType: subjectTypeSchema,
    subjectId: z.string().min(24).max(24),
    page: z.coerce.number().int().min(1).optional().default(1),
    limit: z.coerce.number().int().min(1).max(30).optional().default(10),
    rating: z.coerce.number().int().min(1).max(5).optional(),
  }),
  params: z.object({}).default({}),
});

export const reviewSummarySchema = z.object({
  body: z.object({}).default({}),
  query: z.object({
    subjectType: subjectTypeSchema,
    subjectId: z.string().min(24).max(24),
  }),
  params: z.object({}).default({}),
});

export const bookingReviewContextSchema = z.object({
  body: z.object({}).default({}),
  query: z.object({}).default({}),
  params: z.object({
    bookingId: z.string().min(24).max(24),
  }),
});

export const reviewOwnerDashboardSchema = z.object({
  body: z.object({}).default({}),
  query: z.object({
    page: z.coerce.number().int().min(1).optional().default(1),
    limit: z.coerce.number().int().min(1).max(30).optional().default(10),
    search: z.string().trim().min(1).max(120).optional(),
    rating: z.coerce.number().int().min(1).max(5).optional(),
  }),
  params: z.object({}).default({}),
});

export const reviewDeleteSchema = z.object({
  body: z.object({}).default({}),
  query: z.object({}).default({}),
  params: z.object({
    reviewId: z.string().min(24).max(24),
  }),
});

export const reviewUpdateSchema = z.object({
  body: z.object({
    rating: z.number().int().min(1).max(5),
    title: z.string().trim().min(3).max(120),
    message: z.string().trim().min(10).max(2000),
  }),
  query: z.object({}).default({}),
  params: z.object({
    reviewId: z.string().min(24).max(24),
  }),
});
