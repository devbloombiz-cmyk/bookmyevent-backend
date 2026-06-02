import { Types } from "mongoose";
import { PaymentWithdrawalRequestModel } from "../models/payment-withdrawal-request.model";

const ACTIVE_LOCKED_STATUSES = ["PENDING", "APPROVED", "TRANSFERRED"] as const;

export const paymentWithdrawalRequestRepository = {
  create: (payload: Record<string, unknown>) => PaymentWithdrawalRequestModel.create(payload),
  findById: (withdrawalRequestId: string) =>
    PaymentWithdrawalRequestModel.findById(withdrawalRequestId),
  list: (filters: {
    vendorId?: string;
    venueOwnerId?: string | null;
    status?: string;
    limit?: number;
  }) => {
    const query: Record<string, unknown> = {};
    if (filters.vendorId) {
      query.vendorId = filters.vendorId;
    }
    if (filters.venueOwnerId === null) {
      query.$or = [{ venueOwnerId: { $exists: false } }, { venueOwnerId: null }];
    } else if (filters.venueOwnerId) {
      query.venueOwnerId = filters.venueOwnerId;
    }
    if (filters.status) {
      query.status = filters.status;
    }

    const limit = Math.max(1, Math.min(500, Number(filters.limit) || 200));
    return PaymentWithdrawalRequestModel.find(query).sort({ createdAt: -1 }).limit(limit);
  },
  updateById: (withdrawalRequestId: string, payload: Record<string, unknown>) =>
    PaymentWithdrawalRequestModel.findByIdAndUpdate(withdrawalRequestId, payload, {
      returnDocument: "after",
    }),
  aggregateLockedAmountByPaymentRequestIds: async (
    paymentRequestIds: string[],
    options?: { excludeWithdrawalRequestId?: string },
  ) => {
    const objectIds = paymentRequestIds
      .map((id) => String(id || "").trim())
      .filter((id) => Types.ObjectId.isValid(id))
      .map((id) => new Types.ObjectId(id));

    if (!objectIds.length) {
      return [] as Array<{ _id: Types.ObjectId; amount: number }>;
    }

    const match: Record<string, unknown> = {
      status: { $in: ACTIVE_LOCKED_STATUSES },
    };
    if (
      options?.excludeWithdrawalRequestId &&
      Types.ObjectId.isValid(options.excludeWithdrawalRequestId)
    ) {
      match._id = { $ne: new Types.ObjectId(options.excludeWithdrawalRequestId) };
    }

    return PaymentWithdrawalRequestModel.aggregate<{ _id: Types.ObjectId; amount: number }>([
      { $match: match },
      { $unwind: "$paymentSelections" },
      {
        $match: {
          "paymentSelections.paymentRequestId": { $in: objectIds },
        },
      },
      {
        $group: {
          _id: "$paymentSelections.paymentRequestId",
          amount: { $sum: "$paymentSelections.amount" },
        },
      },
    ]);
  },
  aggregateScopedAmounts: async (filters: { vendorId: string; venueOwnerId?: string | null }) => {
    const match: Record<string, unknown> = { vendorId: new Types.ObjectId(filters.vendorId) };
    if (filters.venueOwnerId === null) {
      match.$or = [{ venueOwnerId: { $exists: false } }, { venueOwnerId: null }];
    } else if (filters.venueOwnerId) {
      match.venueOwnerId = new Types.ObjectId(filters.venueOwnerId);
    }

    return PaymentWithdrawalRequestModel.aggregate<{ _id: string; totalAmount: number }>([
      { $match: match },
      {
        $group: {
          _id: "$status",
          totalAmount: { $sum: "$requestedAmount" },
        },
      },
    ]);
  },
};
