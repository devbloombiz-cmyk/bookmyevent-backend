import { PlatformPackageLeadModel } from "../models/platform-package-lead.model";

export const platformPackageLeadRepository = {
  create: (payload: Record<string, unknown>) => PlatformPackageLeadModel.create(payload),
  findAll: (status?: string) => {
    const query: Record<string, unknown> = {};
    if (status) {
      query.status = status;
    }
    return PlatformPackageLeadModel.find(query).sort({ createdAt: -1 });
  },
  findById: (leadId: string) => PlatformPackageLeadModel.findById(leadId),
  updateById: (leadId: string, payload: Record<string, unknown>) =>
    PlatformPackageLeadModel.findByIdAndUpdate(leadId, payload, { returnDocument: "after" }),
};
