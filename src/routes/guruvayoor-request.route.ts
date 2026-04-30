import { Router } from "express";
import { PermissionKeys } from "../config/permissions";
import { guruvayoorRequestController } from "../controllers/guruvayoor-request.controller";
import { requireAuth } from "../middlewares/auth.middleware";
import { authorize } from "../middlewares/authorize.middleware";
import { validateRequest } from "../middlewares/validate-request.middleware";
import {
  createGuruvayoorRequestSchema,
  listGuruvayoorRequestSchema,
  updateGuruvayoorRequestSchema,
} from "../validators/guruvayoor-request.validator";

const guruvayoorRequestRouter = Router();

guruvayoorRequestRouter.post(
  "/",
  validateRequest(createGuruvayoorRequestSchema),
  guruvayoorRequestController.createRequest,
);
guruvayoorRequestRouter.get(
  "/",
  requireAuth,
  authorize(PermissionKeys.PackageLeadRead),
  validateRequest(listGuruvayoorRequestSchema),
  guruvayoorRequestController.listRequests,
);
guruvayoorRequestRouter.put(
  "/:requestId",
  requireAuth,
  authorize(PermissionKeys.PackageLeadUpdate),
  validateRequest(updateGuruvayoorRequestSchema),
  guruvayoorRequestController.updateRequest,
);

export { guruvayoorRequestRouter };
