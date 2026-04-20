import { leadService } from "../services/lead.service";
import { sendSuccess } from "../utils/api-response";
import { asyncHandler } from "../utils/async-handler";

export const leadController = {
  createLead: asyncHandler(async (req, res) => {
    const authUser = req.authUser;
    if (!authUser) {
      return sendSuccess(res, "Unauthorized", { lead: null }, 401);
    }

    const lead = await leadService.createLead(req.body, authUser);
    return sendSuccess(res, "Lead created", { lead }, 201);
  }),
  listLeads: asyncHandler(async (req, res) => {
    const authUser = req.authUser;
    if (!authUser) {
      return sendSuccess(res, "Unauthorized", { leads: [] }, 401);
    }

    const leads = await leadService.listLeads(authUser, req.query as Record<string, unknown>);
    return sendSuccess(res, "Leads fetched", { leads });
  }),
  updateLead: asyncHandler(async (req, res) => {
    const authUser = req.authUser;
    if (!authUser) {
      return sendSuccess(res, "Unauthorized", { lead: null }, 401);
    }

    const leadId = String(req.params.leadId);
    const lead = await leadService.updateLead(leadId, req.body, authUser);
    return sendSuccess(res, "Lead updated", { lead });
  }),
  convertLeadToBooking: asyncHandler(async (req, res) => {
    const authUser = req.authUser;
    if (!authUser) {
      return sendSuccess(res, "Unauthorized", { booking: null }, 401);
    }

    const leadId = String(req.params.leadId);
    const booking = await leadService.convertLeadToBooking(leadId, req.body, authUser);
    return sendSuccess(res, "Lead converted to booking", { booking });
  }),
};
