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
  listSystemUsers: asyncHandler(async (_req, res) => {
    const users = await userService.listSystemUsers();
    return sendSuccess(res, "System users fetched", { users });
  }),
  createSubAdmin: asyncHandler(async (req, res) => {
    const user = await userService.createSubAdmin(req.body);
    return sendSuccess(res, "System user created", { user }, 201);
  }),
};
