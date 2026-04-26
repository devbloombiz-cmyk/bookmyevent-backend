import { Router } from "express";
import { PermissionKeys } from "../config/permissions";
import { userController } from "../controllers/user.controller";
import { requireAuth } from "../middlewares/auth.middleware";
import { authorize } from "../middlewares/authorize.middleware";
import { validateRequest } from "../middlewares/validate-request.middleware";
import {
  createSubAdminSchema,
  getMyProfileSchema,
  listSystemUsersSchema,
  updateMyProfileSchema,
} from "../validators/user.validator";

const userRouter = Router();

userRouter.get("/me", requireAuth, validateRequest(getMyProfileSchema), userController.getMyProfile);
userRouter.patch("/me", requireAuth, validateRequest(updateMyProfileSchema), userController.updateMyProfile);

userRouter.get(
  "/system-users",
  requireAuth,
  authorize(PermissionKeys.UserSystemRead),
  validateRequest(listSystemUsersSchema),
  userController.listSystemUsers,
);

userRouter.post(
  "/system-users",
  requireAuth,
  authorize(PermissionKeys.UserSystemCreate),
  validateRequest(createSubAdminSchema),
  userController.createSubAdmin,
);

export { userRouter };
