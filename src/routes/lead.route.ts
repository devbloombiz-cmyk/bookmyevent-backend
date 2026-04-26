import { Router } from "express";
import { PermissionKeys } from "../config/permissions";
import { leadController } from "../controllers/lead.controller";
import { requireAuth } from "../middlewares/auth.middleware";
import { authorize } from "../middlewares/authorize.middleware";
import { validateRequest } from "../middlewares/validate-request.middleware";
import {
  convertLeadToBookingSchema,
  createLeadSchema,
  listLeadSchema,
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

export { leadRouter };
