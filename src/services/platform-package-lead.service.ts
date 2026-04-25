import { packageRepository } from "../repositories/package.repository";
import { platformPackageLeadRepository } from "../repositories/platform-package-lead.repository";
import { ApiError } from "../utils/api-error";

export const platformPackageLeadService = {
  createLead: async (payload: {
    packageId: string;
    name: string;
    mobile: string;
    email?: string;
    eventDate?: Date;
    message?: string;
  }) => {
    const selectedPackage = await packageRepository.findPlatformPackageById(payload.packageId);
    if (!selectedPackage || !selectedPackage.isActive) {
      throw new ApiError(404, "Platform package not found");
    }

    return platformPackageLeadRepository.create({
      packageId: payload.packageId,
      packageTitle: selectedPackage.title,
      name: payload.name,
      mobile: payload.mobile,
      email: payload.email ?? "",
      eventDate: payload.eventDate ?? null,
      message: payload.message ?? "",
      status: "new",
    });
  },
  listLeads: (status?: string) => platformPackageLeadRepository.findAll(status),
  updateLead: async (leadId: string, payload: { status?: string; message?: string }) => {
    const updated = await platformPackageLeadRepository.updateById(leadId, payload);
    if (!updated) {
      throw new ApiError(404, "Platform package lead not found");
    }

    return updated;
  },
};
