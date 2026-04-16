import { leadService } from "../services/lead.service";
import { sendSuccess } from "../utils/api-response";
import { asyncHandler } from "../utils/async-handler";

export const leadController = {
  createLead: asyncHandler(async (req, res) => {
    const lead = await leadService.createLead(req.body);
    return sendSuccess(res, "Lead created", { lead }, 201);
  }),
  listLeads: asyncHandler(async (_req, res) => {
    const leads = await leadService.listLeads();
    return sendSuccess(res, "Leads fetched", { leads });
  }),
};
