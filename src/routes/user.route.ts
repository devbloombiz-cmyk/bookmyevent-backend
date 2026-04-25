import { Router } from "express";
import { userController } from "../controllers/user.controller";
import { requireAuth } from "../middlewares/auth.middleware";
import { requireRoles } from "../middlewares/roles.middleware";
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
  requireRoles(["super_admin"]),
  validateRequest(listSystemUsersSchema),
  userController.listSystemUsers,
);

userRouter.post(
  "/system-users",
  requireAuth,
  requireRoles(["super_admin"]),
  validateRequest(createSubAdminSchema),
  userController.createSubAdmin,
);

export { userRouter };
