import { Router } from "express";
import { z } from "zod";
import { vendorLeadActionController } from "../controllers/vendor-lead-action.controller";
import { validateRequest } from "../middlewares/validate-request.middleware";

const vendorLeadActionRouter = Router();

const tokenParamSchema = z.object({
  params: z.object({
    token: z
      .string()
      .length(64)
      .regex(/^[a-f0-9]+$/i, "Invalid token format"),
  }),
});

vendorLeadActionRouter.get(
  "/accept/:token",
  validateRequest(tokenParamSchema),
  vendorLeadActionController.acceptLead,
);

vendorLeadActionRouter.get(
  "/reject/:token",
  validateRequest(tokenParamSchema),
  vendorLeadActionController.rejectLead,
);

vendorLeadActionRouter.get(
  "/review/:token",
  validateRequest(tokenParamSchema),
  vendorLeadActionController.reviewLead,
);

vendorLeadActionRouter.post(
  "/review/:token/accept",
  validateRequest(tokenParamSchema),
  vendorLeadActionController.acceptLeadWithReviewToken,
);

vendorLeadActionRouter.post(
  "/review/:token/reject",
  validateRequest(tokenParamSchema),
  vendorLeadActionController.rejectLeadWithReviewToken,
);

export { vendorLeadActionRouter };
