import { z } from "zod";
import { AdminAccessCollectionKeys } from "../config/admin-access-collections";
import { PermissionKeys } from "../config/permissions";

const validPermissionKeys = new Set<string>(Object.values(PermissionKeys));
const validAccessCollectionKeys = new Set<string>(Object.values(AdminAccessCollectionKeys));

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
    accessCollections: z
      .array(z.string().trim().min(1))
      .min(1)
      .max(20)
      .optional()
      .refine((keys) => !keys || keys.every((key) => validAccessCollectionKeys.has(key)), {
        message: "Invalid access collection key supplied",
      }),
    permissionKeys: z
      .array(z.string().trim().min(1))
      .max(50)
      .optional()
      .refine((keys) => !keys || keys.every((key) => validPermissionKeys.has(key)), {
        message: "Invalid permission key supplied",
      }),
  }),
  query: z.object({}),
  params: z.object({}),
});
