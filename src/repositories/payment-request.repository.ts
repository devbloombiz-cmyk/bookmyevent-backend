import { PaymentRequestModel } from "../models/payment-request.model";

export const paymentRequestRepository = {
  create: (payload: Record<string, unknown>) => PaymentRequestModel.create(payload),
  findById: (paymentRequestId: string) => PaymentRequestModel.findById(paymentRequestId),
  findByLeadId: (leadId: string) => PaymentRequestModel.find({ leadId }).sort({ createdAt: -1 }),
  findLatestAdvanceByLeadId: (leadId: string) =>
    PaymentRequestModel.findOne({ leadId, paymentType: "ADVANCE" }).sort({ createdAt: -1 }),
  findLatestPaidAdvanceByLeadId: (leadId: string) =>
    PaymentRequestModel.findOne({ leadId, paymentType: "ADVANCE", status: "paid" }).sort({ createdAt: -1 }),
  findLatestPendingAdvanceByLeadId: (leadId: string) =>
    PaymentRequestModel.findOne({ leadId, paymentType: "ADVANCE", status: "pending" }).sort({ createdAt: -1 }),
  findByBookingId: (bookingId: string) => PaymentRequestModel.find({ bookingId }).sort({ createdAt: -1 }),
  findLatestPendingByBookingId: (bookingId: string) =>
    PaymentRequestModel.findOne({ bookingId, status: "pending" }).sort({ createdAt: -1 }),
  findByRazorpayReferenceId: (referenceId: string) =>
    PaymentRequestModel.findOne({ razorpayReferenceId: referenceId.trim() }),
  findByRazorpayPaymentLinkId: (paymentLinkId: string) =>
    PaymentRequestModel.findOne({ razorpayPaymentLinkId: paymentLinkId.trim() }),
  updateById: (paymentRequestId: string, payload: Record<string, unknown>) =>
    PaymentRequestModel.findByIdAndUpdate(paymentRequestId, payload, { returnDocument: "after" }),
  updateByIdempotentWebhook: (
    paymentRequestId: string,
    webhookEventId: string,
    payload: Record<string, unknown>,
  ) =>
    PaymentRequestModel.findOneAndUpdate(
      {
        _id: paymentRequestId,
        $or: [
          { webhookEventId: "" },
          { webhookEventId: null },
          { webhookEventId: { $exists: false } },
          { webhookEventId: webhookEventId.trim() },
        ],
      },
      {
        $set: {
          ...payload,
          webhookEventId: webhookEventId.trim(),
        },
      },
      { returnDocument: "after" },
    ),
};
