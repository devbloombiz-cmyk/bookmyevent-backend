import { paymentLedgerService } from "../services/payment-ledger.service";
import { sendSuccess } from "../utils/api-response";
import { asyncHandler } from "../utils/async-handler";
import { ApiError } from "../utils/api-error";

export const paymentLedgerController = {
  listMyPaymentHistory: asyncHandler(async (req, res) => {
    const authUser = req.authUser;
    if (!authUser) {
      throw new ApiError(401, "Unauthorized");
    }

    const result = await paymentLedgerService.listMyPaymentHistory(authUser, req.query);
    return sendSuccess(res, "Payment history fetched", result);
  }),
  createMyWithdrawalRequest: asyncHandler(async (req, res) => {
    const authUser = req.authUser;
    if (!authUser) {
      throw new ApiError(401, "Unauthorized");
    }

    const withdrawalRequest = await paymentLedgerService.createMyWithdrawalRequest(
      authUser,
      req.body,
    );
    return sendSuccess(res, "Withdrawal request created", { withdrawalRequest }, 201);
  }),
  listWithdrawalRequests: asyncHandler(async (req, res) => {
    const authUser = req.authUser;
    if (!authUser) {
      throw new ApiError(401, "Unauthorized");
    }

    const result = await paymentLedgerService.listWithdrawalRequests(authUser, req.query);
    return sendSuccess(res, "Withdrawal requests fetched", result);
  }),
  updateWithdrawalRequestStatus: asyncHandler(async (req, res) => {
    const authUser = req.authUser;
    if (!authUser) {
      throw new ApiError(401, "Unauthorized");
    }

    const withdrawalRequestId = String(req.params.withdrawalRequestId);
    const withdrawalRequest = await paymentLedgerService.updateWithdrawalRequestStatus(
      withdrawalRequestId,
      req.body,
      authUser,
    );

    return sendSuccess(res, "Withdrawal request updated", { withdrawalRequest });
  }),
};
