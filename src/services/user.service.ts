import crypto from "crypto";
import {
  AdminAccessCollectionKeys,
  AdminAccessCollectionPermissionMap,
  DefaultSubAdminCollectionByRole,
  type AccessCollectionKey,
} from "../config/admin-access-collections";
import { PermissionKeys, type PermissionKey } from "../config/permissions";
import { pbacRepository } from "../repositories/pbac.repository";
import { ApiError } from "../utils/api-error";
import { hashPassword } from "../utils/password";
import { userRepository } from "../repositories/user.repository";
import { invalidatePermissionCache, resolveAccessProfileForUser } from "./pbac.service";
import { UserRole } from "../types/domain";
import { UserModel } from "../models/user.model";
import { VendorModel } from "../models/vendor.model";
import { VenueOwnerModel } from "../models/venue-owner.model";
import { BookingModel } from "../models/booking.model";
import { LeadModel } from "../models/lead.model";
import { AccountSubscriptionModel } from "../models/account-subscription.model";
import { RefreshTokenModel } from "../models/refresh-token.model";

type SubAdminRole = Extract<UserRole, "vendor_admin" | "accounts_admin">;

function fallbackEmailFromMobile(mobile: string) {
  const safeMobile = mobile.replace(/[^0-9+]/g, "");
  return `${safeMobile}@bookmyevent.local`;
}

const ALLOWED_SUBADMIN_PERMISSION_KEYS = new Set<PermissionKey>([
  PermissionKeys.WorkspaceAdminAccess,
  PermissionKeys.VendorRead,
  PermissionKeys.VendorUpdateAny,
  PermissionKeys.CategoryManage,
  PermissionKeys.LocationManage,
  PermissionKeys.PackagePlatformRead,
  PermissionKeys.PackagePlatformManage,
  PermissionKeys.PackageLeadRead,
  PermissionKeys.PackageLeadUpdate,
  PermissionKeys.PackageVendorRead,
  PermissionKeys.PackageVendorCreateAny,
  PermissionKeys.PackageVendorUpdateAny,
  PermissionKeys.PackageVendorDeleteAny,
  PermissionKeys.BookingReadAny,
  PermissionKeys.BookingUpdateAny,
  PermissionKeys.LeadReadAny,
  PermissionKeys.LeadUpdateAny,
  PermissionKeys.LeadConvertAny,
  PermissionKeys.UploadImage,
  PermissionKeys.UserSystemRead,
  PermissionKeys.UserSystemCreate,
  PermissionKeys.UserProfileRead,
  PermissionKeys.UserProfileUpdate,
]);

function normalizePermissionKeys(permissionKeys: string[] | undefined): PermissionKey[] {
  if (!permissionKeys?.length) {
    return [];
  }

  const filtered = permissionKeys.filter((key): key is PermissionKey =>
    ALLOWED_SUBADMIN_PERMISSION_KEYS.has(key as PermissionKey),
  );

  return Array.from(new Set(filtered));
}

const ALLOWED_ACCESS_COLLECTIONS = new Set<AccessCollectionKey>(
  Object.values(AdminAccessCollectionKeys),
);

function normalizeAccessCollections(collections: string[] | undefined): AccessCollectionKey[] {
  if (!collections?.length) {
    return [];
  }

  const filtered = collections.filter((collection): collection is AccessCollectionKey =>
    ALLOWED_ACCESS_COLLECTIONS.has(collection as AccessCollectionKey),
  );

  return Array.from(new Set(filtered));
}

function resolvePermissionKeysFromCollections(
  collections: readonly AccessCollectionKey[],
): PermissionKey[] {
  return Array.from(
    new Set(
      collections.flatMap((collection) => AdminAccessCollectionPermissionMap[collection] ?? []),
    ),
  );
}

export const userService = {
  getMyProfile: async (userId: string) => {
    const user = await userRepository.findById(userId);
    if (!user) {
      throw new ApiError(404, "User not found");
    }

    return {
      id: user.id,
      name: user.name,
      email: user.email,
      mobile: user.mobile,
      role: user.role,
      isActive: user.isActive,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };
  },

  deleteMyProfile: async (userId: string, role: string) => {
    if (role !== "customer") {
      throw new ApiError(403, "Only customer accounts can be deleted");
    }

    const user = await userRepository.findById(userId);
    if (!user) {
      throw new ApiError(404, "User not found");
    }

    // Delete custom role bindings for the user
    await pbacRepository.replaceUserRoles(userId, []);

    // Delete active refresh tokens
    await RefreshTokenModel.deleteMany({ userId });

    // Hard delete the user account
    await userRepository.deleteById(userId);
  },

  updateMyProfile: async (
    userId: string,
    payload: {
      name?: string;
      email?: string;
      mobile?: string;
    },
  ) => {
    const user = await userRepository.findById(userId);
    if (!user) {
      throw new ApiError(404, "User not found");
    }

    const updatePayload: { name?: string; email?: string; mobile?: string } = {};

    if (payload.name) {
      updatePayload.name = payload.name.trim();
    }

    if (payload.email) {
      const normalizedEmail = payload.email.trim().toLowerCase();
      const emailOwner = await userRepository.findByEmail(normalizedEmail);
      if (emailOwner && emailOwner.id !== user.id) {
        throw new ApiError(409, "Email already registered");
      }
      updatePayload.email = normalizedEmail;
    }

    if (payload.mobile) {
      const normalizedMobile = payload.mobile.trim();
      const mobileOwner = await userRepository.findByMobile(normalizedMobile);
      if (mobileOwner && mobileOwner.id !== user.id) {
        throw new ApiError(409, "Mobile number already registered");
      }
      updatePayload.mobile = normalizedMobile;
    }

    const updatedUser = await userRepository.updateById(userId, updatePayload);
    if (!updatedUser) {
      throw new ApiError(500, "Unable to update profile");
    }

    return {
      id: updatedUser.id,
      name: updatedUser.name,
      email: updatedUser.email,
      mobile: updatedUser.mobile,
      role: updatedUser.role,
      isActive: updatedUser.isActive,
      createdAt: updatedUser.createdAt,
      updatedAt: updatedUser.updatedAt,
    };
  },

  listSystemUsers: async () => {
    const admins = await Promise.all([
      userRepository.findByRole("super_admin"),
      userRepository.findByRole("vendor_admin"),
      userRepository.findByRole("accounts_admin"),
    ]);

    const users = admins.flat();
    const accessProfiles = await Promise.all(
      users.map((user) => resolveAccessProfileForUser(user.id).catch(() => null)),
    );

    return users.map((user, index) => ({
      id: user.id,
      name: user.name,
      email: user.email,
      mobile: user.mobile,
      role: user.role,
      isActive: user.isActive,
      createdAt: user.createdAt,
      roleKeys: accessProfiles[index]?.roleKeys ?? [],
      permissions: accessProfiles[index]?.permissions ?? [],
    }));
  },

  listCustomers: async () => {
    const customers = await userRepository.findByRole("customer");
    return customers.map((user) => ({
      id: user.id,
      name: user.name,
      email: user.email,
      mobile: user.mobile,
      role: user.role,
      isActive: user.isActive,
      createdAt: user.createdAt,
    }));
  },

  getAdminDashboardOverview: async () => {
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);

    const [
      totalUsers,
      totalVendors,
      totalVenueOwners,
      pendingVendorApprovals,
      pendingVenueApprovals,
      todayBookings,
      revenueAggregate,
      pendingSettlementAggregate,
      activeLeads,
    ] = await Promise.all([
      UserModel.countDocuments({ isActive: true }),
      VendorModel.countDocuments({ isActive: true }),
      VenueOwnerModel.countDocuments({ isActive: true }),
      VendorModel.countDocuments({ approvalStatus: "pending", isActive: true }),
      VenueOwnerModel.countDocuments({ approvalStatus: "pending", isActive: true }),
      BookingModel.countDocuments({ createdAt: { $gte: startOfToday } }),
      BookingModel.aggregate<{ _id: null; total: number }>([
        {
          $match: {
            paymentStatus: "paid",
          },
        },
        {
          $group: {
            _id: null,
            total: { $sum: { $ifNull: ["$paidAmount", 0] } },
          },
        },
      ]),
      BookingModel.aggregate<{ _id: null; total: number }>([
        {
          $match: {
            settlementStatus: "PENDING",
          },
        },
        {
          $group: {
            _id: null,
            total: { $sum: { $ifNull: ["$pendingSettlement", 0] } },
          },
        },
      ]),
      LeadModel.countDocuments({
        status: {
          $in: ["NEW", "CONTACTED", "PAYMENT_DONE"],
        },
      }),
    ]);

    const totalRevenueInr = revenueAggregate[0]?.total ?? 0;
    const pendingSettlementInr = pendingSettlementAggregate[0]?.total ?? 0;

    return {
      totalUsers,
      totalVendors,
      totalVenueOwners,
      pendingVendorApprovals,
      pendingVenueApprovals,
      todayBookings,
      totalRevenueInr,
      pendingSettlementInr,
      activeLeads,
    };
  },

  getAdminRevenueDashboard: async () => {
    const [revenueStats, subscriptionStats] = await Promise.all([
      BookingModel.aggregate<{
        _id: "vendor" | "venue_owner_shadow";
        totalPaid: number;
        totalPendingSettlement: number;
        totalPlatformCommission: number;
        totalVendorPayout: number;
      }>([
        {
          $lookup: {
            from: "vendors",
            localField: "vendorId",
            foreignField: "_id",
            as: "vendorData",
          },
        },
        {
          $unwind: { path: "$vendorData", preserveNullAndEmptyArrays: true },
        },
        {
          $group: {
            _id: { $ifNull: ["$vendorData.profileType", "vendor"] },
            totalPaid: {
              $sum: {
                $cond: [{ $eq: ["$paymentStatus", "paid"] }, { $ifNull: ["$paidAmount", 0] }, 0],
              },
            },
            totalPendingSettlement: {
              $sum: {
                $cond: [
                  { $eq: ["$settlementStatus", "PENDING"] },
                  { $ifNull: ["$pendingSettlement", 0] },
                  0,
                ],
              },
            },
            totalPlatformCommission: {
              $sum: {
                $cond: [
                  { $eq: ["$paymentStatus", "paid"] },
                  {
                    $subtract: [{ $ifNull: ["$paidAmount", 0] }, { $ifNull: ["$vendorAmount", 0] }],
                  },
                  0,
                ],
              },
            },
            totalVendorPayout: {
              $sum: {
                $cond: [{ $eq: ["$paymentStatus", "paid"] }, { $ifNull: ["$vendorAmount", 0] }, 0],
              },
            },
          },
        },
      ]),
      AccountSubscriptionModel.aggregate<{
        _id: "vendor" | "venue_owner";
        totalSubscriptionRevenue: number;
      }>([
        {
          $match: {
            paymentStatus: "confirmed",
          },
        },
        {
          $group: {
            _id: "$actorType",
            totalSubscriptionRevenue: { $sum: { $ifNull: ["$amountInr", 0] } },
          },
        },
      ]),
    ]);

    const dashboard = {
      totalBookingRevenue: 0,
      totalSubscriptionRevenue: 0,
      totalPlatformCommission: 0,
      totalVendorPayout: 0,
      vendors: {
        revenue: 0,
        subscriptionRevenue: 0,
        commission: 0,
        payout: 0,
        pendingSettlement: 0,
      },
      venueOwners: {
        revenue: 0,
        subscriptionRevenue: 0,
        commission: 0,
        payout: 0,
        pendingSettlement: 0,
      },
    };

    for (const stat of revenueStats) {
      if (stat._id === "venue_owner_shadow") {
        dashboard.venueOwners.revenue += stat.totalPaid;
        dashboard.venueOwners.commission += stat.totalPlatformCommission;
        dashboard.venueOwners.payout += stat.totalVendorPayout;
        dashboard.venueOwners.pendingSettlement += stat.totalPendingSettlement;
      } else {
        dashboard.vendors.revenue += stat.totalPaid;
        dashboard.vendors.commission += stat.totalPlatformCommission;
        dashboard.vendors.payout += stat.totalVendorPayout;
        dashboard.vendors.pendingSettlement += stat.totalPendingSettlement;
      }

      dashboard.totalBookingRevenue += stat.totalPaid;
      dashboard.totalPlatformCommission += Math.max(0, stat.totalPlatformCommission);
      dashboard.totalVendorPayout += stat.totalVendorPayout;
    }

    for (const stat of subscriptionStats) {
      if (stat._id === "venue_owner") {
        dashboard.venueOwners.subscriptionRevenue += stat.totalSubscriptionRevenue;
      } else {
        dashboard.vendors.subscriptionRevenue += stat.totalSubscriptionRevenue;
      }
      dashboard.totalSubscriptionRevenue += stat.totalSubscriptionRevenue;
    }

    return dashboard;
  },

  createSubAdmin: async (payload: {
    name: string;
    mobile: string;
    email?: string;
    role: SubAdminRole;
    accessCollections?: string[];
    permissionKeys?: string[];
  }) => {
    const normalizedMobile = payload.mobile.trim();
    const normalizedEmail =
      payload.email?.trim().toLowerCase() || fallbackEmailFromMobile(normalizedMobile);

    const mobileExists = await userRepository.findByMobile(normalizedMobile);
    if (mobileExists) {
      throw new ApiError(409, "Mobile number already registered");
    }

    const emailExists = await userRepository.findByEmail(normalizedEmail);
    if (emailExists) {
      throw new ApiError(409, "Email already registered");
    }

    const temporaryPassword = crypto.randomBytes(16).toString("hex");
    const passwordHash = await hashPassword(temporaryPassword);

    const requestedCollections = normalizeAccessCollections(payload.accessCollections);
    const requestedPermissionKeys = normalizePermissionKeys(payload.permissionKeys);
    const defaultCollections: AccessCollectionKey[] = [
      ...(DefaultSubAdminCollectionByRole[payload.role] ?? []),
    ];

    const effectivePermissionKeys = requestedCollections.length
      ? resolvePermissionKeysFromCollections(requestedCollections)
      : requestedPermissionKeys.length
        ? requestedPermissionKeys
        : resolvePermissionKeysFromCollections(defaultCollections);

    if (!effectivePermissionKeys.length) {
      throw new ApiError(400, "At least one valid permission is required");
    }

    const permissionSet = new Set<PermissionKey>(effectivePermissionKeys);
    permissionSet.add(PermissionKeys.WorkspaceAdminAccess);
    permissionSet.add(PermissionKeys.UserProfileRead);
    permissionSet.add(PermissionKeys.UserProfileUpdate);

    const resolvedPermissionKeys = Array.from(permissionSet);
    await Promise.all(
      resolvedPermissionKeys.map((key) =>
        pbacRepository.upsertPermission(key, `System permission: ${key}`),
      ),
    );

    const user = await userRepository.create({
      name: payload.name.trim(),
      email: normalizedEmail,
      mobile: normalizedMobile,
      passwordHash,
      role: payload.role,
    });

    const dynamicRole = await pbacRepository.upsertCustomRole(
      `staff:${user.id}`,
      `${payload.name.trim()} Access Profile`,
      "Custom access profile configured by super admin",
    );

    if (!dynamicRole) {
      throw new ApiError(500, "Unable to create access profile for system user");
    }

    const permissionDocs = await pbacRepository.listPermissionsByKeys(resolvedPermissionKeys);
    const permissionIds = permissionDocs.map((permission) => String(permission._id));

    if (!permissionIds.length || permissionIds.length < resolvedPermissionKeys.length) {
      throw new ApiError(400, "Selected permissions are not available");
    }

    await pbacRepository.replaceRolePermissions(String(dynamicRole._id), permissionIds);
    await pbacRepository.replaceUserRoles(user.id, [String(dynamicRole._id)]);
    await invalidatePermissionCache(user.id);

    const accessProfile = await resolveAccessProfileForUser(user.id);

    return {
      id: user.id,
      name: user.name,
      email: user.email,
      mobile: user.mobile,
      role: user.role,
      isActive: user.isActive,
      createdAt: user.createdAt,
      roleKeys: accessProfile.roleKeys,
      permissions: accessProfile.permissions,
    };
  },
};
