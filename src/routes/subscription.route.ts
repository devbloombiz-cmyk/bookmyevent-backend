import { Router } from "express";
import { subscriptionController } from "../controllers/subscription.controller";
import { requireAuth } from "../middlewares/auth.middleware";
import { authorize } from "../middlewares/authorize.middleware";
import { PermissionKeys } from "../config/permissions";
import { validateRequest } from "../middlewares/validate-request.middleware";
import {
  adminListSubscriptionRequestsSchema,
  adminConfirmSubscriptionPaymentSchema,
  createSubscriptionCheckoutIntentSchema,
  getMySubscriptionSchema,
  listMySubscriptionPlansSchema,
  subscriptionRazorpayWebhookSchema,
} from "../validators/subscription.validator";

const subscriptionRouter = Router();

subscriptionRouter.get(
  "/me",
  requireAuth,
  authorize([PermissionKeys.WorkspaceVendorAccess, PermissionKeys.WorkspaceVenueOwnerAccess]),
  validateRequest(getMySubscriptionSchema),
  subscriptionController.getMyOverview,
);

subscriptionRouter.get(
  "/plans/me",
  requireAuth,
  authorize([PermissionKeys.WorkspaceVendorAccess, PermissionKeys.WorkspaceVenueOwnerAccess]),
  validateRequest(listMySubscriptionPlansSchema),
  subscriptionController.listMyPlans,
);

subscriptionRouter.post(
  "/checkout-intent/me",
  requireAuth,
  authorize([PermissionKeys.WorkspaceVendorAccess, PermissionKeys.WorkspaceVenueOwnerAccess]),
  validateRequest(createSubscriptionCheckoutIntentSchema),
  subscriptionController.createMyCheckoutIntent,
);

subscriptionRouter.post(
  "/admin/confirm-payment/:subscriptionId",
  requireAuth,
  authorize(PermissionKeys.VendorUpdateAny),
  validateRequest(adminConfirmSubscriptionPaymentSchema),
  subscriptionController.confirmPaymentByAdmin,
);

subscriptionRouter.get(
  "/admin/requests",
  requireAuth,
  authorize(PermissionKeys.VendorRead),
  validateRequest(adminListSubscriptionRequestsSchema),
  subscriptionController.listSubscriptionsByAdmin,
);

subscriptionRouter.post(
  "/webhooks/razorpay",
  validateRequest(subscriptionRazorpayWebhookSchema),
  subscriptionController.razorpayWebhook,
);

export { subscriptionRouter };
