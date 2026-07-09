import { Router } from "express";
import { PermissionKeys } from "../config/permissions";
import { paymentLedgerController } from "../controllers/payment-ledger.controller";
import { requireAuth } from "../middlewares/auth.middleware";
import { authorize } from "../middlewares/authorize.middleware";
import { validateRequest } from "../middlewares/validate-request.middleware";
import { paymentRateLimiter } from "../middlewares/rate-limit.middleware";
import {
  createWithdrawalRequestSchema,
  listWithdrawalRequestsSchema,
  paymentHistoryListSchema,
  updateWithdrawalRequestStatusSchema,
} from "../validators/payment-ledger.validator";

const paymentLedgerRouter = Router();

paymentLedgerRouter.get(
  "/history",
  requireAuth,
  authorize([PermissionKeys.BookingReadOwnVendor, PermissionKeys.BookingReadAny]),
  validateRequest(paymentHistoryListSchema),
  paymentLedgerController.listMyPaymentHistory,
);

paymentLedgerRouter.post(
  "/withdrawals",
  requireAuth,
  paymentRateLimiter,
  authorize([PermissionKeys.BookingReadOwnVendor, PermissionKeys.BookingReadAny]),
  validateRequest(createWithdrawalRequestSchema),
  paymentLedgerController.createMyWithdrawalRequest,
);

paymentLedgerRouter.get(
  "/withdrawals",
  requireAuth,
  authorize([PermissionKeys.BookingReadOwnVendor, PermissionKeys.BookingReadAny]),
  validateRequest(listWithdrawalRequestsSchema),
  paymentLedgerController.listWithdrawalRequests,
);

paymentLedgerRouter.patch(
  "/withdrawals/:withdrawalRequestId/status",
  requireAuth,
  paymentRateLimiter,
  authorize([PermissionKeys.BookingUpdateAny]),
  validateRequest(updateWithdrawalRequestStatusSchema),
  paymentLedgerController.updateWithdrawalRequestStatus,
);

export { paymentLedgerRouter };
