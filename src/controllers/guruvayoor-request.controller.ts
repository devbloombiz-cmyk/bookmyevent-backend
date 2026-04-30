import { guruvayoorRequestService } from "../services/guruvayoor-request.service";
import { sendSuccess } from "../utils/api-response";
import { asyncHandler } from "../utils/async-handler";

export const guruvayoorRequestController = {
  createRequest: asyncHandler(async (req, res) => {
    const request = await guruvayoorRequestService.createRequest(req.body);
    return sendSuccess(res, "Guruvayoor request submitted", { request }, 201);
  }),
  listRequests: asyncHandler(async (req, res) => {
    const status = typeof req.query.status === "string" ? req.query.status : undefined;
    const requests = await guruvayoorRequestService.listRequests(status);
    return sendSuccess(res, "Guruvayoor requests fetched", { requests });
  }),
  updateRequest: asyncHandler(async (req, res) => {
    const requestId = String(req.params.requestId);
    const request = await guruvayoorRequestService.updateRequest(requestId, req.body);
    return sendSuccess(res, "Guruvayoor request updated", { request });
  }),
};
