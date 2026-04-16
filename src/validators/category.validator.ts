import { z } from "zod";

export const categoryCreateSchema = z.object({
  body: z.object({
    name: z.string().min(2),
    displayName: z.string().min(2).optional(),
    description: z.string().optional().default(""),
    icon: z.string().optional().default(""),
    coverImage: z.url().optional().default(""),
    isFeatured: z.boolean().optional().default(false),
    subCategories: z
      .array(
        z.object({
          name: z.string().min(2),
          displayName: z.string().optional(),
          image: z.url().optional().default(""),
          isActive: z.boolean().default(true),
        }),
      )
      .default([]),
  }),
  query: z.object({}),
  params: z.object({}),
});
