import { z } from "zod";
import { PermissionKeys } from "../config/permissions";

const allowedOperatorPermissionKeys = new Set<string>([
  PermissionKeys.AvailabilityReadOwn,
  PermissionKeys.AvailabilityWriteOwn,
  PermissionKeys.BookingReadOwnVendor,
  PermissionKeys.BookingUpdateOwnVendor,
  PermissionKeys.LeadReadOwnVendor,
  PermissionKeys.LeadUpdateOwnVendor,
  PermissionKeys.LeadConvertOwnVendor,
  PermissionKeys.PackageVendorRead,
  PermissionKeys.PackageVendorCreateOwn,
  PermissionKeys.PackageVendorUpdateOwn,
  PermissionKeys.PackageVendorDeleteOwn,
  PermissionKeys.VendorRead,
  PermissionKeys.VendorUpdateOwn,
  PermissionKeys.GalleryRead,
  PermissionKeys.GalleryWrite,
  PermissionKeys.UploadImage,
  PermissionKeys.UserProfileRead,
  PermissionKeys.UserProfileUpdate,
]);

export const listWorkspaceOperatorsSchema = z.object({
  body: z.object({}).default({}),
  query: z.object({}).default({}),
  params: z.object({}).default({}),
});

export const createWorkspaceOperatorSchema = z.object({
  body: z.object({
    name: z.string().trim().min(2),
    mobile: z.string().trim().min(8).max(20),
    email: z.email().optional(),
    permissionKeys: z
      .array(z.string().trim().min(1))
      .min(1)
      .max(40)
      .refine((keys) => keys.every((key) => allowedOperatorPermissionKeys.has(key)), {
        message: "Invalid operator permission key supplied",
      }),
  }),
  query: z.object({}).default({}),
  params: z.object({}).default({}),
});

export const updateWorkspaceOperatorSchema = z.object({
  body: z
    .object({
      isActive: z.boolean().optional(),
      permissionKeys: z
        .array(z.string().trim().min(1))
        .min(1)
        .max(40)
        .optional()
        .refine((keys) => !keys || keys.every((key) => allowedOperatorPermissionKeys.has(key)), {
          message: "Invalid operator permission key supplied",
        }),
    })
    .refine((payload) => payload.isActive !== undefined || payload.permissionKeys !== undefined, {
      message: "Provide isActive or permissionKeys",
    }),
  query: z.object({}).default({}),
  params: z.object({
    operatorUserId: z.string().trim().min(1),
  }),
});
