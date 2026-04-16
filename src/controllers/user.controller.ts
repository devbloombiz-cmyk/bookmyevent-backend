import { userService } from "../services/user.service";
import { sendSuccess } from "../utils/api-response";
import { asyncHandler } from "../utils/async-handler";

export const userController = {
  listSystemUsers: asyncHandler(async (_req, res) => {
    const users = await userService.listSystemUsers();
    return sendSuccess(res, "System users fetched", { users });
  }),
  createSubAdmin: asyncHandler(async (req, res) => {
    const user = await userService.createSubAdmin(req.body);
    return sendSuccess(res, "System user created", { user }, 201);
  }),
};
