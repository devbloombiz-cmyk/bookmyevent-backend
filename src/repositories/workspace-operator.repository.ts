import { WorkspaceOperatorModel } from "../models/workspace-operator.model";

export const workspaceOperatorRepository = {
  create: (payload: Record<string, unknown>) => WorkspaceOperatorModel.create(payload),
  findByOperatorUserId: (operatorUserId: string) =>
    WorkspaceOperatorModel.findOne({ operatorUserId }),
  findByVendor: (vendorId: string) =>
    WorkspaceOperatorModel.find({ ownerType: "vendor", vendorId }).sort({ createdAt: -1 }),
  findByVenueOwner: (venueOwnerId: string) =>
    WorkspaceOperatorModel.find({ ownerType: "venue_owner", venueOwnerId }).sort({ createdAt: -1 }),
  findByOwnerAndOperatorUserId: (payload: {
    ownerType: "vendor" | "venue_owner";
    ownerId: string;
    operatorUserId: string;
  }) =>
    WorkspaceOperatorModel.findOne(
      payload.ownerType === "vendor"
        ? { ownerType: "vendor", vendorId: payload.ownerId, operatorUserId: payload.operatorUserId }
        : {
            ownerType: "venue_owner",
            venueOwnerId: payload.ownerId,
            operatorUserId: payload.operatorUserId,
          },
    ),
  updateById: (id: string, payload: Record<string, unknown>) =>
    WorkspaceOperatorModel.findByIdAndUpdate(id, payload, { returnDocument: "after" }),
};
