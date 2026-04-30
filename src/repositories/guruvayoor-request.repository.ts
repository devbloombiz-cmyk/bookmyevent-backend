import { GuruvayoorRequestModel } from "../models/guruvayoor-request.model";

export const guruvayoorRequestRepository = {
  create: (payload: Record<string, unknown>) => GuruvayoorRequestModel.create(payload),
  findAll: (status?: string) => {
    const query: Record<string, unknown> = {};
    if (status) {
      query.status = status;
    }

    return GuruvayoorRequestModel.find(query).sort({ createdAt: -1 });
  },
  findById: (requestId: string) => GuruvayoorRequestModel.findById(requestId),
  updateById: (requestId: string, payload: Record<string, unknown>) =>
    GuruvayoorRequestModel.findByIdAndUpdate(requestId, payload, { returnDocument: "after" }),
};
