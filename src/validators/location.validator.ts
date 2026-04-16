import { z } from "zod";

export const createLocationSchema = z.object({
  body: z.object({
    state: z.string().min(2).default("Kerala"),
    district: z.string().min(2),
    city: z.string().min(2),
  }),
  query: z.object({}),
  params: z.object({}),
});

export const listLocationSchema = z.object({
  body: z.object({}).default({}),
  query: z.object({}).default({}),
  params: z.object({}).default({}),
});
