import { Router } from "express";
import { leadController } from "../controllers/lead.controller";
import { requireAuth } from "../middlewares/auth.middleware";
import { requireRoles } from "../middlewares/roles.middleware";
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
  requireRoles(["vendor", "vendor_admin", "super_admin", "accounts_admin"]),
  validateRequest(listLeadSchema),
  leadController.listLeads,
);

leadRouter.post("/", requireAuth, validateRequest(createLeadSchema), leadController.createLead);
leadRouter.put(
  "/:leadId",
  requireAuth,
  requireRoles(["vendor", "vendor_admin", "super_admin", "accounts_admin"]),
  validateRequest(updateLeadSchema),
  leadController.updateLead,
);
leadRouter.post(
  "/:leadId/convert-booking",
  requireAuth,
  requireRoles(["vendor", "vendor_admin", "super_admin", "accounts_admin"]),
  validateRequest(convertLeadToBookingSchema),
  leadController.convertLeadToBooking,
);

export { leadRouter };
