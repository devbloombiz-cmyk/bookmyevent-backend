import { operatorService } from "../services/operator.service";
import { sendSuccess } from "../utils/api-response";
import { asyncHandler } from "../utils/async-handler";

export const operatorController = {
  listMyWorkspaceOperators: asyncHandler(async (req, res) => {
    const operators = await operatorService.listMyWorkspaceOperators(req.authUser!);
    return sendSuccess(res, "Workspace operators fetched", { operators });
  }),

  createMyWorkspaceOperator: asyncHandler(async (req, res) => {
    const operator = await operatorService.createMyWorkspaceOperator(req.body, req.authUser!);
    return sendSuccess(res, "Workspace operator created", { operator }, 201);
  }),

  updateMyWorkspaceOperator: asyncHandler(async (req, res) => {
    const operatorUserId = Array.isArray(req.params.operatorUserId)
      ? req.params.operatorUserId[0]
      : req.params.operatorUserId;

    const operator = await operatorService.updateMyWorkspaceOperator(
      String(operatorUserId || ""),
      req.body,
      req.authUser!,
    );
    return sendSuccess(res, "Workspace operator updated", { operator });
  }),
};
