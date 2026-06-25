import { userService } from "../services/user.service";
import { sendSuccess } from "../utils/api-response";
import { asyncHandler } from "../utils/async-handler";

export const userController = {
  getMyProfile: asyncHandler(async (req, res) => {
    const profile = await userService.getMyProfile(req.authUser!.id);
    return sendSuccess(res, "Profile fetched", { profile });
  }),
  updateMyProfile: asyncHandler(async (req, res) => {
    const profile = await userService.updateMyProfile(req.authUser!.id, req.body);
    return sendSuccess(res, "Profile updated", { profile });
  }),
  deleteMyProfile: asyncHandler(async (req, res) => {
    await userService.deleteMyProfile(req.authUser!.id, req.authUser!.role);
    return sendSuccess(res, "Account deleted successfully", null);
  }),
  listSystemUsers: asyncHandler(async (_req, res) => {
    const users = await userService.listSystemUsers();
    return sendSuccess(res, "System users fetched", { users });
  }),
  listCustomers: asyncHandler(async (_req, res) => {
    const users = await userService.listCustomers();
    return sendSuccess(res, "Customers fetched", { users });
  }),
  getAdminDashboardOverview: asyncHandler(async (_req, res) => {
    const overview = await userService.getAdminDashboardOverview();
    return sendSuccess(res, "Admin dashboard overview fetched", { overview });
  }),
  getAdminRevenueDashboard: asyncHandler(async (_req, res) => {
    const dashboard = await userService.getAdminRevenueDashboard();
    return sendSuccess(res, "Admin revenue dashboard fetched", { dashboard });
  }),
  createSubAdmin: asyncHandler(async (req, res) => {
    const user = await userService.createSubAdmin(req.body);
    return sendSuccess(res, "System user created", { user }, 201);
  }),
  getUserDetails: asyncHandler(async (req, res) => {
    const user = await userService.getUserDetails(req.params.id as string);
    return sendSuccess(res, "User details fetched", { user });
  }),
  updateUser: asyncHandler(async (req, res) => {
    const user = await userService.updateUser(req.params.id as string, req.body);
    return sendSuccess(res, "User updated successfully", { user });
  }),
  deleteUser: asyncHandler(async (req, res) => {
    await userService.deleteUser(req.params.id as string);
    return sendSuccess(res, "User deleted successfully", null);
  }),
};
