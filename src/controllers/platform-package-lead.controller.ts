import { platformPackageLeadService } from "../services/platform-package-lead.service";
import { sendSuccess } from "../utils/api-response";
import { asyncHandler } from "../utils/async-handler";

export const platformPackageLeadController = {
  createLead: asyncHandler(async (req, res) => {
    const lead = await platformPackageLeadService.createLead(req.body);
    return sendSuccess(res, "Package enquiry captured", { lead }, 201);
  }),
  listLeads: asyncHandler(async (req, res) => {
    const status = typeof req.query.status === "string" ? req.query.status : undefined;
    const leads = await platformPackageLeadService.listLeads(status);
    return sendSuccess(res, "Package enquiries fetched", { leads });
  }),
  updateLead: asyncHandler(async (req, res) => {
    const leadId = String(req.params.leadId);
    const lead = await platformPackageLeadService.updateLead(leadId, req.body);
    return sendSuccess(res, "Package enquiry updated", { lead });
  }),
};
