import { PermissionModel } from "../models/permission.model";
import { RoleModel } from "../models/role.model";
import { RolePermissionModel } from "../models/role-permission.model";
import { UserRoleModel } from "../models/user-role.model";

export const pbacRepository = {
  upsertPermission: (key: string, description: string) =>
    PermissionModel.findOneAndUpdate(
      { key },
      { $set: { key, description, isSystem: true, isActive: true } },
      { upsert: true, new: true },
    ),

  upsertRole: (key: string, name: string, description: string) =>
    RoleModel.findOneAndUpdate(
      { key },
      { $set: { key, name, description, isSystem: true, isActive: true } },
      { upsert: true, new: true },
    ),

  upsertCustomRole: (key: string, name: string, description: string) =>
    RoleModel.findOneAndUpdate(
      { key },
      { $set: { key, name, description, isSystem: false, isActive: true } },
      { upsert: true, new: true },
    ),

  bindRolePermission: (roleId: string, permissionId: string) =>
    RolePermissionModel.findOneAndUpdate(
      { roleId, permissionId },
      { $set: { roleId, permissionId } },
      { upsert: true, new: true },
    ),

  bindUserRole: (userId: string, roleId: string) =>
    UserRoleModel.findOneAndUpdate(
      { userId, roleId },
      { $set: { userId, roleId } },
      { upsert: true, new: true },
    ),

  listRolesByUserId: (userId: string) =>
    UserRoleModel.find({ userId }).populate("roleId").lean(),

  listPermissionsByRoleIds: (roleIds: string[]) =>
    RolePermissionModel.find({ roleId: { $in: roleIds } }).populate("permissionId").lean(),

  listPermissionsByKeys: (keys: string[]) => PermissionModel.find({ key: { $in: keys } }),

  replaceRolePermissions: async (roleId: string, permissionIds: string[]) => {
    await RolePermissionModel.deleteMany({ roleId });
    if (!permissionIds.length) {
      return;
    }

    const uniquePermissionIds = Array.from(new Set(permissionIds));
    await RolePermissionModel.insertMany(
      uniquePermissionIds.map((permissionId) => ({ roleId, permissionId })),
      { ordered: false },
    );
  },

  replaceUserRoles: async (userId: string, roleIds: string[]) => {
    await UserRoleModel.deleteMany({ userId });
    if (!roleIds.length) {
      return;
    }

    const uniqueRoleIds = Array.from(new Set(roleIds));
    await UserRoleModel.insertMany(
      uniqueRoleIds.map((roleId) => ({ userId, roleId })),
      { ordered: false },
    );
  },

  findRoleByKey: (key: string) => RoleModel.findOne({ key }),
  findPermissionByKey: (key: string) => PermissionModel.findOne({ key }),
};
