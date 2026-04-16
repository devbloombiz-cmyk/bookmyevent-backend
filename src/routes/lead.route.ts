import { Router } from "express";
import { leadController } from "../controllers/lead.controller";
import { requireAuth } from "../middlewares/auth.middleware";
import { requireRoles } from "../middlewares/roles.middleware";
import { validateRequest } from "../middlewares/validate-request.middleware";
import { createLeadSchema } from "../validators/lead.validator";

const leadRouter = Router();

leadRouter.get(
  "/",
  requireAuth,
  requireRoles(["vendor", "vendor_admin", "super_admin", "accounts_admin"]),
  leadController.listLeads,
);

leadRouter.post("/", requireAuth, validateRequest(createLeadSchema), leadController.createLead);

export { leadRouter };
