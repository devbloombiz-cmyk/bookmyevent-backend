import { Router } from "express";
import { PermissionKeys } from "../config/permissions";
import { leadController } from "../controllers/lead.controller";
import { requireAuth } from "../middlewares/auth.middleware";
import { authorize } from "../middlewares/authorize.middleware";
import { validateRequest } from "../middlewares/validate-request.middleware";
import {
  convertLeadToBookingSchema,
  createOfferForLeadSchema,
  createLeadSchema,
  listLeadSchema,
  markLeadAdvanceReceivedSchema,
  recordManualAdvancePaymentSchema,
  sendOfferPaymentLinkSchema,
  updateLeadSchema,
} from "../validators/lead.validator";

const leadRouter = Router();

leadRouter.get(
  "/",
  requireAuth,
  authorize([PermissionKeys.LeadReadOwnVendor, PermissionKeys.LeadReadAny]),
  validateRequest(listLeadSchema),
  leadController.listLeads,
);

leadRouter.post("/", requireAuth, validateRequest(createLeadSchema), leadController.createLead);
leadRouter.put(
  "/:leadId",
  requireAuth,
  authorize([PermissionKeys.LeadUpdateOwnVendor, PermissionKeys.LeadUpdateAny]),
  validateRequest(updateLeadSchema),
  leadController.updateLead,
);
leadRouter.post(
  "/:leadId/convert-booking",
  requireAuth,
  authorize([PermissionKeys.LeadConvertOwnVendor, PermissionKeys.LeadConvertAny]),
  validateRequest(convertLeadToBookingSchema),
  leadController.convertLeadToBooking,
);
leadRouter.post(
  "/:leadId/offers",
  requireAuth,
  authorize([PermissionKeys.LeadUpdateOwnVendor, PermissionKeys.LeadUpdateAny]),
  validateRequest(createOfferForLeadSchema),
  leadController.createOfferForLead,
);
leadRouter.post(
  "/:leadId/offers/:paymentRequestId/send",
  requireAuth,
  authorize([PermissionKeys.LeadUpdateOwnVendor, PermissionKeys.LeadUpdateAny]),
  validateRequest(sendOfferPaymentLinkSchema),
  leadController.sendOfferPaymentLinkToCustomer,
);
leadRouter.post(
  "/:leadId/manual-advance-payment",
  requireAuth,
  authorize([PermissionKeys.LeadUpdateOwnVendor, PermissionKeys.LeadUpdateAny]),
  validateRequest(recordManualAdvancePaymentSchema),
  leadController.recordManualAdvancePayment,
);
leadRouter.post(
  "/:leadId/mark-advance-received",
  requireAuth,
  authorize([PermissionKeys.LeadUpdateOwnVendor, PermissionKeys.LeadUpdateAny]),
  validateRequest(markLeadAdvanceReceivedSchema),
  leadController.markLeadAdvanceReceived,
);

export { leadRouter };
