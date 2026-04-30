import { guruvayoorRequestRepository } from "../repositories/guruvayoor-request.repository";
import { ApiError } from "../utils/api-error";

export const guruvayoorRequestService = {
  createRequest: (payload: Record<string, unknown>) => guruvayoorRequestRepository.create(payload),
  listRequests: (status?: string) => guruvayoorRequestRepository.findAll(status),
  updateRequest: async (requestId: string, payload: Record<string, unknown>) => {
    const updated = await guruvayoorRequestRepository.updateById(requestId, payload);
    if (!updated) {
      throw new ApiError(404, "Guruvayoor request not found");
    }

    return updated;
  },
};
