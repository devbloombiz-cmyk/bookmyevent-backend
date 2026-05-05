import { PermissionKeys, type PermissionKey } from "./permissions";

export const AdminAccessCollectionKeys = {
  Users: "users",
  Vendors: "vendors",
  Catalog: "catalog",
  Packages: "packages",
  Revenue: "revenue",
  Bookings: "bookings",
  Cms: "cms",
} as const;

export type AccessCollectionKey =
  (typeof AdminAccessCollectionKeys)[keyof typeof AdminAccessCollectionKeys];

export const AdminAccessCollectionPermissionMap: Record<AccessCollectionKey, PermissionKey[]> = {
  [AdminAccessCollectionKeys.Users]: [
    PermissionKeys.UserSystemRead,
    PermissionKeys.UserSystemCreate,
  ],
  [AdminAccessCollectionKeys.Vendors]: [
    PermissionKeys.VendorRead,
    PermissionKeys.VendorUpdateAny,
    PermissionKeys.UploadImage,
  ],
  [AdminAccessCollectionKeys.Catalog]: [
    PermissionKeys.CategoryManage,
    PermissionKeys.LocationManage,
    PermissionKeys.UploadImage,
  ],
  [AdminAccessCollectionKeys.Packages]: [
    PermissionKeys.PackagePlatformRead,
    PermissionKeys.PackagePlatformManage,
    PermissionKeys.PackageVendorRead,
    PermissionKeys.PackageVendorCreateAny,
    PermissionKeys.PackageVendorUpdateAny,
    PermissionKeys.PackageVendorDeleteAny,
    PermissionKeys.PackageLeadRead,
    PermissionKeys.PackageLeadUpdate,
  ],
  [AdminAccessCollectionKeys.Revenue]: [
    PermissionKeys.BookingReadAny,
    PermissionKeys.PackageLeadRead,
    PermissionKeys.PackageLeadUpdate,
  ],
  [AdminAccessCollectionKeys.Bookings]: [
    PermissionKeys.BookingReadAny,
    PermissionKeys.BookingUpdateAny,
    PermissionKeys.LeadReadAny,
    PermissionKeys.LeadUpdateAny,
    PermissionKeys.LeadConvertAny,
  ],
  [AdminAccessCollectionKeys.Cms]: [
    PermissionKeys.CategoryManage,
  ],
};

export const DefaultSubAdminCollectionByRole = {
  vendor_admin: [
    AdminAccessCollectionKeys.Vendors,
    AdminAccessCollectionKeys.Catalog,
    AdminAccessCollectionKeys.Packages,
    AdminAccessCollectionKeys.Bookings,
  ],
  accounts_admin: [AdminAccessCollectionKeys.Revenue],
} as const;
