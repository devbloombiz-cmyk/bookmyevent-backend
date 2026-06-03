import { PermissionKeys, type PermissionKey } from "../config/permissions";
import { bookingRepository } from "../repositories/booking.repository";
import { leadRepository } from "../repositories/lead.repository";
import { paymentRequestRepository } from "../repositories/payment-request.repository";
import { paymentWithdrawalRequestRepository } from "../repositories/payment-withdrawal-request.repository";
import { vendorRepository } from "../repositories/vendor.repository";
import { venueOwnerRepository } from "../repositories/venue-owner.repository";
import type { AuthenticatedUser } from "../types/auth-user";
import { ApiError } from "../utils/api-error";
import {
  resolveVendorIdForAuthUser,
  resolveVendorIdForScopedUser,
  resolveVenueOwnerIdForAuthUser,
} from "./vendor-identity.service";
import { activityTimelineService } from "./activity-timeline.service";

type AuthUser = Pick<AuthenticatedUser, "id" | "permissions"> & {
  permissions: PermissionKey[];
};

type ScopedActorContext = {
  vendorId: string;
  venueOwnerId: string | null;
  ownerType: "vendor" | "venue_owner";
};

type PaymentHistoryFilters = {
  limit?: number;
};

type CreateWithdrawalPayload = {
  paymentSelections: Array<{
    paymentRequestId: string;
    amount: number;
  }>;
  requestNote?: string;
};

type ListWithdrawalFilters = {
  limit?: number;
  status?: "PENDING" | "APPROVED" | "REJECTED" | "TRANSFERRED";
  vendorId?: string;
  ownerType?: "vendor" | "venue_owner";
};

type UpdateWithdrawalStatusPayload = {
  action: "approve" | "reject" | "mark_transferred";
  note?: string;
  transferReference?: string;
  transferredAt?: string;
};

function roundToMoney(value: number) {
  return Number(Number(value || 0).toFixed(2));
}

function normalizeSelectionRows(
  paymentSelections: Array<{ paymentRequestId: string; amount: number }>,
) {
  const merged = new Map<string, number>();

  for (const row of paymentSelections) {
    const paymentRequestId = String(row.paymentRequestId || "").trim();
    const amount = Number(row.amount || 0);

    if (!paymentRequestId) {
      throw new ApiError(400, "paymentRequestId is required for each selection");
    }

    if (!Number.isFinite(amount) || amount <= 0) {
      throw new ApiError(400, "Each selected amount must be greater than zero");
    }

    merged.set(paymentRequestId, roundToMoney((merged.get(paymentRequestId) || 0) + amount));
  }

  return Array.from(merged.entries()).map(([paymentRequestId, amount]) => ({
    paymentRequestId,
    amount,
  }));
}

async function resolveScopedActorContext(authUser: AuthUser) {
  if (authUser.permissions.includes(PermissionKeys.ScopeVenueOwnerOwn)) {
    const [vendorId, venueOwnerId] = await Promise.all([
      resolveVendorIdForScopedUser(authUser),
      resolveVenueOwnerIdForAuthUser(authUser),
    ]);

    return {
      vendorId,
      venueOwnerId,
      ownerType: "venue_owner",
    } as ScopedActorContext;
  }

  if (authUser.permissions.includes(PermissionKeys.ScopeVendorOwn)) {
    const vendorId = await resolveVendorIdForAuthUser(authUser);
    return {
      vendorId,
      venueOwnerId: null,
      ownerType: "vendor",
    } as ScopedActorContext;
  }

  return null;
}

async function buildLeadMapsForPaymentRequests(rows: Array<Record<string, unknown>>) {
  const bookingIds = Array.from(
    new Set(rows.map((row) => String(row.bookingId || "")).filter((id) => Boolean(id))),
  );
  const directLeadIds = Array.from(
    new Set(rows.map((row) => String(row.leadId || "")).filter((id) => Boolean(id))),
  );

  const bookingRows = bookingIds.length ? await bookingRepository.findByIds(bookingIds) : [];
  const bookingById = new Map(
    bookingRows.map((item) => {
      const row = item.toObject() as Record<string, unknown>;
      return [String(item._id), row] as const;
    }),
  );

  const leadIdsFromBookings = bookingRows
    .map((item) => String(item.leadId || ""))
    .filter((id) => Boolean(id));
  const leadIds = Array.from(new Set([...directLeadIds, ...leadIdsFromBookings]));
  const leadRows = leadIds.length ? await leadRepository.findByIds(leadIds) : [];
  const leadById = new Map(
    leadRows.map((item) => {
      const row = item.toObject() as Record<string, unknown>;
      return [String(item._id), row] as const;
    }),
  );

  return {
    bookingById,
    leadById,
  };
}

function resolveEffectiveLeadIdForPaymentRequest(
  row: Record<string, unknown>,
  bookingById: Map<string, Record<string, unknown>>,
) {
  const leadId = String(row.leadId || "");
  if (leadId) {
    return leadId;
  }

  const bookingId = String(row.bookingId || "");
  if (!bookingId) {
    return "";
  }

  const booking = bookingById.get(bookingId);
  return String(booking?.leadId || "");
}

async function filterPaymentRequestsByScope(
  rows: Array<Record<string, unknown>>,
  context: ScopedActorContext,
) {
  const { bookingById, leadById } = await buildLeadMapsForPaymentRequests(rows);

  return rows.filter((row) => {
    const effectiveLeadId = resolveEffectiveLeadIdForPaymentRequest(row, bookingById);
    const lead = effectiveLeadId ? leadById.get(effectiveLeadId) : null;

    if (context.venueOwnerId) {
      return String(lead?.venueOwnerId || "") === context.venueOwnerId;
    }

    return !lead?.venueOwnerId;
  });
}

function buildAmountMap(rows: Array<{ _id: unknown; amount: number }>) {
  const amountById = new Map<string, number>();

  for (const row of rows) {
    amountById.set(String(row._id), roundToMoney(Number(row.amount || 0)));
  }

  return amountById;
}

function hasNonEmptyString(value: unknown) {
  return String(value || "").trim().length > 0;
}

function isRazorpayCapturedPaymentRequest(row: Record<string, unknown>) {
  const status = String(row.status || "").toLowerCase();
  const paidAmount = Number(row.paidAmount || row.requestedAmount || 0);

  return (
    status === "paid" &&
    paidAmount > 0 &&
    (hasNonEmptyString(row.razorpayPaymentId) || hasNonEmptyString(row.webhookEventId))
  );
}

async function assertWithdrawalSelectionsAreEligible(
  context: ScopedActorContext,
  selections: Array<{ paymentRequestId: string; amount: number }>,
  options?: { excludeWithdrawalRequestId?: string },
) {
  const paymentRequestIds = selections.map((item) => item.paymentRequestId);
  const paymentRows = await paymentRequestRepository.findByIds(paymentRequestIds);
  if (paymentRows.length !== paymentRequestIds.length) {
    throw new ApiError(404, "One or more selected payment records were not found");
  }

  const rawPaymentRows = paymentRows.map((item) => item.toObject() as Record<string, unknown>);
  const scopedRows = await filterPaymentRequestsByScope(rawPaymentRows, context);
  if (scopedRows.length !== rawPaymentRows.length) {
    throw new ApiError(
      403,
      "You are not allowed to withdraw against one or more selected payments",
    );
  }

  const scopedById = new Map(scopedRows.map((row) => [String(row._id), row]));
  const lockedRows =
    await paymentWithdrawalRequestRepository.aggregateLockedAmountByPaymentRequestIds(
      paymentRequestIds,
      options,
    );
  const lockedByPaymentRequestId = buildAmountMap(lockedRows);

  for (const selection of selections) {
    const payment = scopedById.get(selection.paymentRequestId);
    if (!payment) {
      throw new ApiError(404, "Selected payment was not found for withdrawal");
    }

    if (!isRazorpayCapturedPaymentRequest(payment)) {
      throw new ApiError(
        400,
        `Withdrawal is allowed only for Razorpay received payments (${selection.paymentRequestId})`,
      );
    }

    const paidAmount = roundToMoney(Number(payment.paidAmount || payment.requestedAmount || 0));
    const lockedAmount = roundToMoney(
      lockedByPaymentRequestId.get(selection.paymentRequestId) || 0,
    );
    const availableAmount = roundToMoney(Math.max(0, paidAmount - lockedAmount));

    if (selection.amount > availableAmount) {
      throw new ApiError(
        400,
        `Requested withdrawal exceeds available amount for payment ${selection.paymentRequestId}`,
      );
    }
  }
}

export const paymentLedgerService = {
  listMyPaymentHistory: async (authUser: AuthUser, filters: PaymentHistoryFilters) => {
    const context = await resolveScopedActorContext(authUser);
    if (!context) {
      throw new ApiError(403, "Scoped vendor or venue owner access is required");
    }

    const limit = Math.max(1, Math.min(1000, Number(filters.limit) || 500));
    const paidRequests = await paymentRequestRepository.findPaidByVendor(context.vendorId, limit);
    const normalizedRows = paidRequests.map((item) => item.toObject() as Record<string, unknown>);
    const scopedRows = await filterPaymentRequestsByScope(normalizedRows, context);
    const razorpayRows = scopedRows.filter((row) => isRazorpayCapturedPaymentRequest(row));

    const paymentRequestIds = razorpayRows.map((row) => String(row._id));
    const lockedRows =
      await paymentWithdrawalRequestRepository.aggregateLockedAmountByPaymentRequestIds(
        paymentRequestIds,
      );
    const lockedAmountByPaymentRequestId = buildAmountMap(lockedRows);

    const scopedSummaryRows = await paymentWithdrawalRequestRepository.aggregateScopedAmounts({
      vendorId: context.vendorId,
      venueOwnerId: context.venueOwnerId,
    });

    const totalRequestedPending = roundToMoney(
      scopedSummaryRows
        .filter((row) => row._id === "PENDING" || row._id === "APPROVED")
        .reduce((acc, row) => acc + Number(row.totalAmount || 0), 0),
    );
    const totalTransferred = roundToMoney(
      scopedSummaryRows
        .filter((row) => row._id === "TRANSFERRED")
        .reduce((acc, row) => acc + Number(row.totalAmount || 0), 0),
    );

    const history = razorpayRows.map((row) => {
      const paymentRequestId = String(row._id || "");
      const paidAmount = roundToMoney(Number(row.paidAmount || row.requestedAmount || 0));
      const lockedAmount = roundToMoney(lockedAmountByPaymentRequestId.get(paymentRequestId) || 0);
      const availableAmount = roundToMoney(Math.max(0, paidAmount - lockedAmount));

      return {
        ...row,
        paidAmount,
        lockedAmount,
        availableAmount,
      };
    });

    const totalReceived = roundToMoney(
      history.reduce((acc, row) => acc + Number(row.paidAmount || 0), 0),
    );
    const totalAvailable = roundToMoney(
      Math.max(0, totalReceived - totalRequestedPending - totalTransferred),
    );

    return {
      summary: {
        totalReceived,
        totalRequestedPending,
        totalTransferred,
        totalAvailable,
      },
      payments: history,
    };
  },

  createMyWithdrawalRequest: async (authUser: AuthUser, payload: CreateWithdrawalPayload) => {
    const context = await resolveScopedActorContext(authUser);
    if (!context) {
      throw new ApiError(403, "Scoped vendor or venue owner access is required");
    }

    if (!Array.isArray(payload.paymentSelections) || payload.paymentSelections.length === 0) {
      throw new ApiError(400, "At least one payment selection is required");
    }

    const normalizedSelections = normalizeSelectionRows(payload.paymentSelections);
    await assertWithdrawalSelectionsAreEligible(context, normalizedSelections);

    const requestedAmount = roundToMoney(
      normalizedSelections.reduce((acc, item) => acc + Number(item.amount || 0), 0),
    );
    if (requestedAmount <= 0) {
      throw new ApiError(400, "Requested withdrawal amount must be greater than zero");
    }

    const created = await paymentWithdrawalRequestRepository.create({
      vendorId: context.vendorId,
      venueOwnerId: context.venueOwnerId,
      requestedByUserId: authUser.id,
      ownerType: context.ownerType,
      status: "PENDING",
      requestedAmount,
      paymentSelections: normalizedSelections,
      requestNote: String(payload.requestNote || "").trim(),
      metadata: {
        paymentSelectionCount: normalizedSelections.length,
      },
    });

    await activityTimelineService.addEvent({
      entityType: "payment_request",
      entityId: String(created._id),
      vendorId: context.vendorId,
      actorUserId: authUser.id,
      event: "WITHDRAWAL_REQUEST_CREATED",
      message: "Withdrawal request submitted",
      metadata: {
        requestedAmount,
        paymentSelections: normalizedSelections,
      },
    });

    return created;
  },

  listWithdrawalRequests: async (authUser: AuthUser, filters: ListWithdrawalFilters) => {
    const context = await resolveScopedActorContext(authUser);
    const limit = Math.max(1, Math.min(500, Number(filters.limit) || 200));

    const queryFilters: {
      vendorId?: string;
      venueOwnerId?: string | null;
      status?: string;
      limit?: number;
    } = {
      status: filters.status,
      limit,
    };

    if (context) {
      queryFilters.vendorId = context.vendorId;
      queryFilters.venueOwnerId = context.venueOwnerId;
    } else {
      if (filters.vendorId) {
        queryFilters.vendorId = filters.vendorId;
      }
      if (filters.ownerType === "vendor") {
        queryFilters.venueOwnerId = null;
      }
    }

    const rows = await paymentWithdrawalRequestRepository.list(queryFilters);
    const normalizedRows = rows.map((item) => item.toObject() as Record<string, unknown>);

    const vendorIds = Array.from(
      new Set(
        normalizedRows.map((item) => String(item.vendorId || "")).filter((id) => Boolean(id)),
      ),
    );
    const venueOwnerIds = Array.from(
      new Set(
        normalizedRows.map((item) => String(item.venueOwnerId || "")).filter((id) => Boolean(id)),
      ),
    );

    const [vendors, venueOwners] = await Promise.all([
      vendorIds.length ? vendorRepository.findByIds(vendorIds) : Promise.resolve([]),
      venueOwnerIds.length ? venueOwnerRepository.findByIds(venueOwnerIds) : Promise.resolve([]),
    ]);

    const vendorById = new Map(
      vendors.map((vendor) => [String(vendor._id), String(vendor.businessName || "")]),
    );
    const venueOwnerById = new Map(
      venueOwners.map((owner) => [String(owner._id), String(owner.businessName || "")]),
    );

    return {
      withdrawalRequests: normalizedRows.map((item) => ({
        ...item,
        vendorName: vendorById.get(String(item.vendorId || "")) || "",
        venueOwnerName: item.venueOwnerId
          ? venueOwnerById.get(String(item.venueOwnerId || "")) || ""
          : "",
      })),
    };
  },

  updateWithdrawalRequestStatus: async (
    withdrawalRequestId: string,
    payload: UpdateWithdrawalStatusPayload,
    authUser: AuthUser,
  ) => {
    const existing = await paymentWithdrawalRequestRepository.findById(withdrawalRequestId);
    if (!existing) {
      throw new ApiError(404, "Withdrawal request not found");
    }

    const action = payload.action;
    const note = String(payload.note || "").trim();
    const now = new Date();

    const normalizedExistingSelections = normalizeSelectionRows(
      Array.isArray(existing.paymentSelections)
        ? existing.paymentSelections.map((item) => {
            const row = item as { paymentRequestId?: unknown; amount?: unknown };
            return {
              paymentRequestId: String(row.paymentRequestId || "").trim(),
              amount: Number(row.amount || 0),
            };
          })
        : [],
    );

    const existingContext: ScopedActorContext = {
      vendorId: String(existing.vendorId || ""),
      venueOwnerId: existing.venueOwnerId ? String(existing.venueOwnerId) : null,
      ownerType: String(existing.ownerType || "") === "venue_owner" ? "venue_owner" : "vendor",
    };

    if (action === "approve") {
      if (String(existing.status) !== "PENDING") {
        throw new ApiError(409, "Only pending requests can be approved");
      }

      await assertWithdrawalSelectionsAreEligible(existingContext, normalizedExistingSelections, {
        excludeWithdrawalRequestId: withdrawalRequestId,
      });

      const updated = await paymentWithdrawalRequestRepository.updateById(withdrawalRequestId, {
        status: "APPROVED",
        adminNote: note,
        reviewedByUserId: authUser.id,
        reviewedAt: now,
      });

      if (!updated) {
        throw new ApiError(404, "Withdrawal request not found");
      }

      await activityTimelineService.addEvent({
        entityType: "payment_request",
        entityId: withdrawalRequestId,
        vendorId: String(existing.vendorId || ""),
        actorUserId: authUser.id,
        event: "WITHDRAWAL_REQUEST_APPROVED",
        message: "Withdrawal request approved",
        metadata: { note },
      });

      return updated;
    }

    if (action === "reject") {
      if (!["PENDING", "APPROVED"].includes(String(existing.status || ""))) {
        throw new ApiError(409, "Only pending or approved requests can be rejected");
      }

      const updated = await paymentWithdrawalRequestRepository.updateById(withdrawalRequestId, {
        status: "REJECTED",
        adminNote: note,
        reviewedByUserId: authUser.id,
        reviewedAt: now,
      });

      if (!updated) {
        throw new ApiError(404, "Withdrawal request not found");
      }

      await activityTimelineService.addEvent({
        entityType: "payment_request",
        entityId: withdrawalRequestId,
        vendorId: String(existing.vendorId || ""),
        actorUserId: authUser.id,
        event: "WITHDRAWAL_REQUEST_REJECTED",
        message: "Withdrawal request rejected",
        metadata: { note },
      });

      return updated;
    }

    if (String(existing.status) !== "APPROVED") {
      throw new ApiError(409, "Only approved requests can be marked transferred");
    }

    await assertWithdrawalSelectionsAreEligible(existingContext, normalizedExistingSelections, {
      excludeWithdrawalRequestId: withdrawalRequestId,
    });

    const transferReference = String(payload.transferReference || "").trim();
    if (!transferReference) {
      throw new ApiError(400, "transferReference is required when marking transfer complete");
    }

    const transferredAt = payload.transferredAt ? new Date(payload.transferredAt) : now;
    if (Number.isNaN(transferredAt.getTime())) {
      throw new ApiError(400, "transferredAt must be a valid date");
    }

    const updated = await paymentWithdrawalRequestRepository.updateById(withdrawalRequestId, {
      status: "TRANSFERRED",
      adminNote: note,
      reviewedByUserId: authUser.id,
      reviewedAt: existing.reviewedAt || now,
      transferReference,
      transferredAt,
      transferredByUserId: authUser.id,
    });

    if (!updated) {
      throw new ApiError(404, "Withdrawal request not found");
    }

    await activityTimelineService.addEvent({
      entityType: "payment_request",
      entityId: withdrawalRequestId,
      vendorId: String(existing.vendorId || ""),
      actorUserId: authUser.id,
      event: "WITHDRAWAL_REQUEST_TRANSFERRED",
      message: "Withdrawal marked transferred",
      metadata: {
        note,
        transferReference,
        transferredAt: transferredAt.toISOString(),
      },
    });

    return updated;
  },
};
