import { Router } from "express";
import { PermissionKeys } from "../config/permissions";
import { operatorController } from "../controllers/operator.controller";
import { requireAuth } from "../middlewares/auth.middleware";
import { authorize } from "../middlewares/authorize.middleware";
import { validateRequest } from "../middlewares/validate-request.middleware";
import {
  createWorkspaceOperatorSchema,
  listWorkspaceOperatorsSchema,
  updateWorkspaceOperatorSchema,
} from "../validators/operator.validator";

const operatorRouter = Router();

operatorRouter.get(
  "/me",
  requireAuth,
  authorize(PermissionKeys.OperatorReadOwn),
  validateRequest(listWorkspaceOperatorsSchema),
  operatorController.listMyWorkspaceOperators,
);

operatorRouter.post(
  "/me",
  requireAuth,
  authorize(PermissionKeys.OperatorCreateOwn),
  validateRequest(createWorkspaceOperatorSchema),
  operatorController.createMyWorkspaceOperator,
);

operatorRouter.put(
  "/me/:operatorUserId",
  requireAuth,
  authorize(PermissionKeys.OperatorUpdateOwn),
  validateRequest(updateWorkspaceOperatorSchema),
  operatorController.updateMyWorkspaceOperator,
);

export { operatorRouter };
