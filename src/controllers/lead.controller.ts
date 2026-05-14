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
  createOfferForLead: asyncHandler(async (req, res) => {
    const authUser = req.authUser;
    if (!authUser) {
      return sendSuccess(res, "Unauthorized", { paymentRequest: null }, 401);
    }

    const leadId = String(req.params.leadId);
    const paymentRequest = await leadService.createOfferForLead(leadId, req.body, authUser);
    return sendSuccess(res, "Offer created", { paymentRequest }, 201);
  }),
  sendOfferPaymentLinkToCustomer: asyncHandler(async (req, res) => {
    const authUser = req.authUser;
    if (!authUser) {
      return sendSuccess(res, "Unauthorized", { paymentRequest: null }, 401);
    }

    const leadId = String(req.params.leadId);
    const paymentRequestId = String(req.params.paymentRequestId);
    const paymentRequest = await leadService.sendOfferPaymentLinkToCustomer(
      leadId,
      paymentRequestId,
      req.body,
      authUser,
    );
    return sendSuccess(res, "Payment link sent to customer", { paymentRequest });
  }),
  recordManualAdvancePayment: asyncHandler(async (req, res) => {
    const authUser = req.authUser;
    if (!authUser) {
      return sendSuccess(res, "Unauthorized", { paymentRequest: null, booking: null }, 401);
    }

    const leadId = String(req.params.leadId);
    const result = await leadService.recordManualAdvancePaymentForLead(leadId, req.body, authUser);
    return sendSuccess(res, "Manual payment recorded", result, 201);
  }),
};
