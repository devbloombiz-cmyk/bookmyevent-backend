import { z } from "zod";

export const listSystemUsersSchema = z.object({
  body: z.object({}).default({}),
  query: z.object({}).default({}),
  params: z.object({}).default({}),
});

export const getMyProfileSchema = z.object({
  body: z.object({}).default({}),
  query: z.object({}).default({}),
  params: z.object({}).default({}),
});

export const updateMyProfileSchema = z.object({
  body: z
    .object({
      name: z.string().min(2).optional(),
      email: z.email().optional(),
      mobile: z.string().min(8).max(20).optional(),
    })
    .refine((payload) => Boolean(payload.name || payload.email || payload.mobile), {
      message: "Provide name, email, or mobile to update",
    }),
  query: z.object({}).default({}),
  params: z.object({}).default({}),
});

export const createSubAdminSchema = z.object({
  body: z.object({
    name: z.string().min(2),
    mobile: z.string().min(8).max(20),
    email: z.email().optional(),
    role: z.enum(["vendor_admin", "accounts_admin"]),
  }),
  query: z.object({}),
  params: z.object({}),
});
