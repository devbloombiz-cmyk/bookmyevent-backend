import crypto from "crypto";
import Razorpay from "razorpay";
import { env } from "../config/env";
import { logger } from "../config/logger";
import { bookingRepository } from "../repositories/booking.repository";
import { leadRepository } from "../repositories/lead.repository";
import { paymentRequestRepository } from "../repositories/payment-request.repository";
import { subscriptionRepository } from "../repositories/subscription.repository";
import { userRepository } from "../repositories/user.repository";
import { availabilityRepository } from "../repositories/availability.repository";
import { PermissionKeys, type PermissionKey } from "../config/permissions";
import type { AuthenticatedUser } from "../types/auth-user";
import { ApiError } from "../utils/api-error";
import {
  resolveVendorIdForScopedUser,
  resolveVenueOwnerIdForAuthUser,
} from "./vendor-identity.service";
import { activityTimelineService } from "./activity-timeline.service";
import { ultramsgWhatsappService } from "./notifications/whatsapp/ultramsg-whatsapp.service";
import { bookingPolicyService } from "./booking-policy.service";

type AuthUser = Pick<AuthenticatedUser, "id" | "permissions"> & {
  permissions: PermissionKey[];
};

type CreateOfferPayload = {
  packageId: string;
  packageName?: string;
  finalAmount: number;
  advanceAmount: number;
  notes?: string;
  paymentExpiry?: string;
  sendWhatsApp?: boolean;
};

type CreateBalancePayload = {
  amount: number;
  paymentType?: "BALANCE" | "EXTRA";
  notes?: string;
  paymentExpiry?: string;
  sendWhatsApp?: boolean;
  customerMobile?: string;
};

type RecordManualBookingPaymentPayload = {
  amount: number;
  paymentType?: "BALANCE" | "EXTRA";
  notes?: string;
};

function resolveRazorpayCredentials() {
  if (env.RAZORPAY_ENV === "live") {
    return {
      keyId: (env.RAZORPAY_KEY_ID_LIVE || env.RAZORPAY_KEY_ID || "").trim(),
      keySecret: (env.RAZORPAY_KEY_SECRET_LIVE || env.RAZORPAY_KEY_SECRET || "").trim(),
      webhookSecret: (env.RAZORPAY_WEBHOOK_SECRET_LIVE || env.RAZORPAY_WEBHOOK_SECRET || "").trim(),
    };
  }

  return {
    keyId: (env.RAZORPAY_KEY_ID_TEST || env.RAZORPAY_KEY_ID || "").trim(),
    keySecret: (env.RAZORPAY_KEY_SECRET_TEST || env.RAZORPAY_KEY_SECRET || "").trim(),
    webhookSecret: (env.RAZORPAY_WEBHOOK_SECRET_TEST || env.RAZORPAY_WEBHOOK_SECRET || "").trim(),
  };
}

function buildRazorpayClient() {
  const credentials = resolveRazorpayCredentials();
  if (!credentials.keyId || !credentials.keySecret) {
    throw new ApiError(500, "Razorpay credentials are not configured");
  }

  return {
    client: new Razorpay({ key_id: credentials.keyId, key_secret: credentials.keySecret }),
    credentials,
  };
}

function normalizeMobile(rawValue: string) {
  const trimmed = String(rawValue || "").trim();
  const digits = trimmed.replace(/\D/g, "");
  return digits.length >= 10 ? digits : "";
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function extractFromMessage(message: string | undefined, label: string) {
  if (!message) {
    return "";
  }

  const aliases: Record<string, string[]> = {
    customer: ["Customer Name", "Name"],
    mobile: ["Mobile Number", "Contact", "Contact Number", "Phone", "Phone Number", "WhatsApp"],
    email: ["Email Address", "Mail"],
  };

  const normalizedKey = label.trim().toLowerCase();
  const candidates = [label, ...(aliases[normalizedKey] || [])];
  for (const candidate of candidates) {
    const regex = new RegExp(`(?:^|\\n)\\s*${escapeRegExp(candidate)}\\s*:\\s*([^\\n\\r]+)`, "i");
    const value = message.match(regex)?.[1]?.trim();
    if (value) {
      return value;
    }
  }

  return "";
}

async function ensureLeadAccess(leadId: string, authUser: AuthUser) {
  const lead = await leadRepository.findById(leadId);
  if (!lead) {
    throw new ApiError(404, "Lead not found");
  }

  if (
    authUser.permissions.includes(PermissionKeys.ScopeVendorOwn) ||
    authUser.permissions.includes(PermissionKeys.ScopeVenueOwnerOwn)
  ) {
    const vendorId = await resolveVendorIdForScopedUser(authUser);
    if (String(lead.vendorId) !== vendorId) {
      throw new ApiError(403, "You are not allowed to access this lead");
    }

    if (authUser.permissions.includes(PermissionKeys.ScopeVenueOwnerOwn)) {
      const venueOwnerId = await resolveVenueOwnerIdForAuthUser(authUser);
      if (String(lead.venueOwnerId || "") !== venueOwnerId) {
        throw new ApiError(403, "You are not allowed to access this lead");
      }
    }

    if (authUser.permissions.includes(PermissionKeys.ScopeVendorOwn) && lead.venueOwnerId) {
      throw new ApiError(403, "You are not allowed to access this lead");
    }
  }

  return lead;
}

async function ensureBookingAccess(bookingId: string, authUser: AuthUser) {
  const booking = await bookingRepository.findById(bookingId);
  if (!booking) {
    throw new ApiError(404, "Booking not found");
  }

  if (
    authUser.permissions.includes(PermissionKeys.ScopeVendorOwn) ||
    authUser.permissions.includes(PermissionKeys.ScopeVenueOwnerOwn)
  ) {
    const vendorId = await resolveVendorIdForScopedUser(authUser);
    if (String(booking.vendorId) !== vendorId) {
      throw new ApiError(403, "You are not allowed to access this booking");
    }

    const lead = booking.leadId ? await leadRepository.findById(String(booking.leadId)) : null;

    if (authUser.permissions.includes(PermissionKeys.ScopeVenueOwnerOwn)) {
      const venueOwnerId = await resolveVenueOwnerIdForAuthUser(authUser);
      if (!lead || String(lead.venueOwnerId || "") !== venueOwnerId) {
        throw new ApiError(403, "You are not allowed to access this booking");
      }
    }

    if (authUser.permissions.includes(PermissionKeys.ScopeVendorOwn) && lead?.venueOwnerId) {
      throw new ApiError(403, "You are not allowed to access this booking");
    }
  }

  return booking;
}

async function resolveBookingCustomerContact(booking: Record<string, unknown>) {
  const lead = booking.leadId ? await leadRepository.findById(String(booking.leadId)) : null;
  const customer = booking.customerId
    ? await userRepository.findById(String(booking.customerId))
    : null;

  const customerName =
    String(booking.customerName || "").trim() ||
    String(customer?.name || "").trim() ||
    String(lead?.customerName || "").trim() ||
    extractFromMessage(String(lead?.message || ""), "Customer") ||
    "Customer";

  const customerMobile =
    normalizeMobile(String(booking.customerMobile || "")) ||
    normalizeMobile(customer?.mobile || "") ||
    normalizeMobile(String(lead?.customerMobile || "")) ||
    normalizeMobile(extractFromMessage(String(lead?.message || ""), "Mobile"));

  const customerEmail =
    String(booking.customerEmail || "").trim() ||
    String(customer?.email || "").trim() ||
    String(lead?.customerEmail || "").trim() ||
    extractFromMessage(String(lead?.message || ""), "Email");

  return {
    customerName,
    customerMobile,
    customerEmail,
  };
}

async function createRazorpayPaymentLink(payload: {
  customerName: string;
  customerMobile: string;
  customerEmail: string;
  amount: number;
  notes: Record<string, string>;
  referenceId: string;
  expiryEpochSeconds?: number;
}) {
  const { client } = buildRazorpayClient();

  const requestPayload: {
    amount: number;
    currency: "INR";
    accept_partial: boolean;
    reference_id: string;
    description: string;
    customer: { name: string; contact: string; email?: string };
    notify: { sms: boolean; email: boolean; whatsapp: boolean };
    reminder_enable: boolean;
    notes: Record<string, string>;
    expire_by?: number;
  } = {
    amount: Math.round(payload.amount * 100),
    currency: "INR",
    accept_partial: false,
    reference_id: payload.referenceId,
    description: "BookMyEvent payment request",
    customer: {
      name: payload.customerName || "Customer",
      contact: payload.customerMobile,
      email: payload.customerEmail || undefined,
    },
    notify: {
      sms: false,
      email: false,
      whatsapp: false,
    },
    reminder_enable: false,
    notes: payload.notes,
  };

  if (payload.expiryEpochSeconds) {
    requestPayload.expire_by = payload.expiryEpochSeconds;
  }

  let response: {
    id?: string;
    short_url?: string;
    reference_id?: string;
  };

  try {
    response = (await client.paymentLink.create(requestPayload as never)) as unknown as {
      id?: string;
      short_url?: string;
      reference_id?: string;
    };
  } catch (firstError) {
    const statusCode = extractErrorStatusCode(firstError);
    const shouldRetry = statusCode === 0 || statusCode >= 500;

    if (!shouldRetry) {
      throw firstError;
    }

    response = (await client.paymentLink.create(requestPayload as never)) as unknown as {
      id?: string;
      short_url?: string;
      reference_id?: string;
    };
  }

  return {
    id: String(response.id || ""),
    shortUrl: String(response.short_url || ""),
    referenceId: String(response.reference_id || payload.referenceId),
  };
}

function safeDate(input?: string) {
  if (!input) {
    return null;
  }

  const date = new Date(input);
  return Number.isNaN(date.getTime()) ? null : date;
}

function buildRazorpayReferenceId(prefix: "lead" | "booking", entityId: string) {
  const normalizedId = String(entityId || "")
    .replace(/[^a-zA-Z0-9]/g, "")
    .slice(-10);
  const timeToken = Date.now().toString(36);
  const base = `${prefix}_${normalizedId}_${timeToken}`;
  // Razorpay enforces max length of 40 for reference_id.
  return base.slice(0, 40);
}

function extractErrorStatusCode(error: unknown) {
  if (!error || typeof error !== "object") {
    return 0;
  }

  const candidate = error as {
    statusCode?: number;
    status?: number;
    response?: { status?: number; statusCode?: number };
  };

  return Number(
    candidate.statusCode ||
      candidate.status ||
      candidate.response?.status ||
      candidate.response?.statusCode ||
      0,
  );
}

function extractErrorMessage(error: unknown) {
  if (!error || typeof error !== "object") {
    return "Razorpay request failed";
  }

  const candidate = error as {
    description?: string;
    message?: string;
    error?: { description?: string; message?: string };
    response?: {
      data?: {
        error?: { description?: string; message?: string };
        description?: string;
        message?: string;
      };
    };
  };

  return (
    candidate.error?.description ||
    candidate.error?.message ||
    candidate.response?.data?.error?.description ||
    candidate.response?.data?.error?.message ||
    candidate.response?.data?.description ||
    candidate.response?.data?.message ||
    candidate.description ||
    candidate.message ||
    "Razorpay request failed"
  );
}

function toPaymentLinkApiError(error: unknown) {
  const statusCode = extractErrorStatusCode(error);
  const message = extractErrorMessage(error);

  if (statusCode >= 400 && statusCode < 500) {
    return new ApiError(400, `Unable to generate payment link: ${message}`);
  }

  return new ApiError(
    502,
    "Unable to generate payment link. Please verify payment configuration and retry.",
  );
}

async function trySendPaymentLinkWhatsapp(payload: {
  mobile: string;
  amount: number;
  paymentLink: string;
  notes?: string;
  customerName?: string;
  packageName?: string;
  eventType?: string;
  eventDate?: Date;
  functionTime?: string;
  customerEmail?: string;
}) {
  if (!payload.mobile || !ultramsgWhatsappService.isEnabled()) {
    return false;
  }

  const eventDateLabel = payload.eventDate
    ? new Intl.DateTimeFormat("en-GB", {
        day: "2-digit",
        month: "long",
        year: "numeric",
      }).format(payload.eventDate)
    : "Not provided";

  const message = [
    "Booking Approved - Payment Request",
    "",
    `Dear ${payload.customerName || "Customer"},`,
    "",
    "Your booking request has been approved by the vendor.",
    "",
    "* Booking Details",
    `* Package: ${payload.packageName || "Selected Package"}`,
    `* Event Type: ${payload.eventType || "General Event"}`,
    `* Function Date: ${eventDateLabel}`,
    `* Function Time: ${payload.functionTime || "Not specified"}`,
    "",
    `* Advance Payment Amount: INR ${Math.round(payload.amount).toLocaleString("en-IN")}`,
    "",
    "* Customer Details",
    `* Name: ${payload.customerName || "Customer"}`,
    `* Mobile: ${payload.mobile}`,
    `* Email: ${payload.customerEmail || "Not provided"}`,
    "",
    "* Notes",
    payload.notes ||
      "Thank you for choosing BookMyEvent. Kindly complete the advance payment to confirm your booking.",
    "",
    "* Pay Now",
    payload.paymentLink,
    "",
    "Team BookMyEvent",
    "www.bookmyevent.ae",
  ]
    .filter(Boolean)
    .join("\n");

  await ultramsgWhatsappService.sendMessage({
    to: payload.mobile,
    body: message,
    context: "booking_confirmation",
  });

  return true;
}

async function trySendBookingConfirmedWhatsapp(payload: {
  mobile: string;
  bookingId: string;
  customerName?: string;
  packageName?: string;
  eventDate?: Date;
}) {
  if (!payload.mobile || !ultramsgWhatsappService.isEnabled()) {
    return false;
  }

  const eventDateLabel = payload.eventDate
    ? new Intl.DateTimeFormat("en-GB", {
        day: "2-digit",
        month: "long",
        year: "numeric",
      }).format(payload.eventDate)
    : "";
  const message = [
    "Booking Confirmed - BookMyEvent",
    "",
    `Dear ${payload.customerName || "Customer"},`,
    "",
    "Your booking has been successfully confirmed.",
    "",
    "* Booking Details",
    payload.packageName ? `* Package: ${payload.packageName}` : "",
    eventDateLabel ? `* Event Date: ${eventDateLabel}` : "",
    `* Booking ID: ${payload.bookingId}`,
    "",
    "Thank you for choosing BookMyEvent.",
    "We look forward to making your event memorable.",
    "",
    "Team BookMyEvent",
    "www.bookmyevent.ae",
  ]
    .filter(Boolean)
    .join("\n");

  await ultramsgWhatsappService.sendMessage({
    to: payload.mobile,
    body: message,
    context: "booking_confirmation",
  });

  return true;
}

async function applyPaymentToBooking(bookingId: string, amountPaidDelta: number) {
  const booking = await bookingRepository.findById(bookingId);
  if (!booking) {
    return null;
  }

  const totalAmount = Number(booking.amount || 0);
  const existingAdvance = Number(booking.advancePaid || 0);
  const basePaid = Math.max(Number(booking.paidAmount || 0), existingAdvance);
  const nextPaid = Math.max(0, basePaid + amountPaidDelta);
  const nextDue = Math.max(0, totalAmount - nextPaid);

  const updated = await bookingRepository.updateById(bookingId, {
    paidAmount: nextPaid,
    advancePaid: existingAdvance,
    dueAmount: nextDue,
    paymentStatus: nextDue <= 0 ? "paid" : "pending",
    settlementStatus: Number(booking.pendingSettlement || totalAmount) <= 0 ? "SETTLED" : "PENDING",
    pendingSettlement: Math.max(
      0,
      Number(booking.vendorAmount || totalAmount) - Number(booking.settledAmount || 0),
    ),
  });

  return updated;
}

export const paymentRequestService = {
  createOfferForLead: async (leadId: string, payload: CreateOfferPayload, authUser: AuthUser) => {
    const lead = await ensureLeadAccess(leadId, authUser);

    if (!payload.packageId) {
      throw new ApiError(400, "packageId is required");
    }

    if (!Number.isFinite(payload.finalAmount) || payload.finalAmount <= 0) {
      throw new ApiError(400, "finalAmount must be greater than zero");
    }

    if (!Number.isFinite(payload.advanceAmount) || payload.advanceAmount <= 0) {
      throw new ApiError(400, "advanceAmount must be greater than zero");
    }

    if (payload.advanceAmount > payload.finalAmount) {
      throw new ApiError(400, "advanceAmount cannot exceed finalAmount");
    }

    const customerName =
      String(lead.customerName || "").trim() ||
      extractFromMessage(String(lead.message || ""), "Customer") ||
      "Customer";
    const customerMobile =
      normalizeMobile(String(lead.customerMobile || "")) ||
      normalizeMobile(extractFromMessage(String(lead.message || ""), "Mobile"));
    const customerEmail =
      String(lead.customerEmail || "").trim() ||
      extractFromMessage(String(lead.message || ""), "Email");

    if (!customerMobile) {
      throw new ApiError(400, "Customer mobile number is required to generate payment link");
    }

    const paymentExpiryDate = safeDate(payload.paymentExpiry);
    const referenceId = buildRazorpayReferenceId("lead", String(lead._id));

    let paymentLink: { id: string; shortUrl: string; referenceId: string };
    try {
      paymentLink = await createRazorpayPaymentLink({
        customerName,
        customerMobile,
        customerEmail,
        amount: payload.advanceAmount,
        referenceId,
        expiryEpochSeconds: paymentExpiryDate
          ? Math.floor(paymentExpiryDate.getTime() / 1000)
          : undefined,
        notes: {
          leadId: String(lead._id),
          paymentType: "ADVANCE",
        },
      });
    } catch (error) {
      const normalizedError = toPaymentLinkApiError(error);
      logger.error(
        {
          event: "payment.link.create_failed",
          leadId: String(lead._id),
          referenceId,
          statusCode: extractErrorStatusCode(error),
          errorMessage: extractErrorMessage(error),
          error,
        },
        "Razorpay payment link creation failed",
      );
      throw normalizedError;
    }

    if (!paymentLink.id || !paymentLink.shortUrl) {
      logger.error(
        {
          event: "payment.link.invalid_response",
          leadId: String(lead._id),
          referenceId,
          response: paymentLink,
        },
        "Razorpay payment link response is missing required fields",
      );
      throw new ApiError(502, "Unable to generate payment link. Please try again.");
    }

    const sentToWhatsapp =
      payload.sendWhatsApp === true
        ? await trySendPaymentLinkWhatsapp({
            mobile: customerMobile,
            amount: payload.advanceAmount,
            paymentLink: paymentLink.shortUrl,
            notes: payload.notes,
            customerName,
            customerEmail,
            packageName: payload.packageName || lead.venuePackageName || "",
            eventType: lead.venuePackageName || "Event",
            eventDate: lead.eventDate ? new Date(lead.eventDate) : undefined,
            functionTime: lead.eventSlot || "",
          })
        : false;

    const paymentRequest = await paymentRequestRepository.create({
      leadId: lead._id,
      vendorId: lead.vendorId,
      customerId: lead.customerId ?? null,
      packageId: payload.packageId,
      packageName: payload.packageName || lead.venuePackageName || "",
      paymentType: "ADVANCE",
      status: "pending",
      finalAmount: payload.finalAmount,
      requestedAmount: payload.advanceAmount,
      paidAmount: 0,
      notes: payload.notes || "",
      paymentExpiry: paymentExpiryDate,
      razorpayPaymentLinkId: paymentLink.id,
      razorpayReferenceId: paymentLink.referenceId,
      paymentLinkUrl: paymentLink.shortUrl,
      sentToWhatsapp,
      metadata: {
        source: "LEAD_OFFER",
      },
    });

    await leadRepository.updateById(leadId, {
      status: "CONTACTED",
      packageId: payload.packageId,
      venuePackageName: payload.packageName || lead.venuePackageName || "",
      quoteAmount: payload.finalAmount,
      paymentLink: paymentLink.shortUrl,
      paymentStatus: "pending",
    });

    await activityTimelineService.addEvent({
      entityType: "lead",
      entityId: String(lead._id),
      vendorId: String(lead.vendorId),
      actorUserId: authUser.id,
      event: "OFFER_CREATED",
      message: "Offer created and payment link generated",
      metadata: {
        paymentRequestId: String(paymentRequest._id),
        finalAmount: payload.finalAmount,
        advanceAmount: payload.advanceAmount,
      },
    });

    return paymentRequest;
  },

  sendOfferPaymentLinkToCustomer: async (
    leadId: string,
    paymentRequestId: string,
    payload: { notes?: string },
    authUser: AuthUser,
  ) => {
    const lead = await ensureLeadAccess(leadId, authUser);
    const paymentRequest = await paymentRequestRepository.findById(paymentRequestId);
    if (!paymentRequest || String(paymentRequest.leadId || "") !== String(lead._id)) {
      throw new ApiError(404, "Payment request not found for this lead");
    }

    const mobile =
      normalizeMobile(String(lead.customerMobile || "")) ||
      normalizeMobile(extractFromMessage(String(lead.message || ""), "Mobile"));

    if (!mobile) {
      throw new ApiError(400, "Customer mobile number is required");
    }

    if (!String(paymentRequest.paymentLinkUrl || "").trim()) {
      throw new ApiError(400, "Payment link is not generated for this request");
    }

    const sentToWhatsapp = await trySendPaymentLinkWhatsapp({
      mobile,
      amount: Number(paymentRequest.requestedAmount || 0),
      paymentLink: String(paymentRequest.paymentLinkUrl || ""),
      notes: payload.notes || String(paymentRequest.notes || ""),
      customerName:
        String(lead.customerName || "").trim() ||
        extractFromMessage(String(lead.message || ""), "Customer") ||
        "Customer",
      customerEmail:
        String(lead.customerEmail || "").trim() ||
        extractFromMessage(String(lead.message || ""), "Email") ||
        "",
      packageName: String(paymentRequest.packageName || lead.venuePackageName || ""),
      eventType: String(lead.venuePackageName || "Event"),
      eventDate: lead.eventDate ? new Date(lead.eventDate) : undefined,
      functionTime: String(lead.eventSlot || ""),
    });

    const updated = await paymentRequestRepository.updateById(String(paymentRequest._id), {
      sentToWhatsapp,
    });

    await activityTimelineService.addEvent({
      entityType: "lead",
      entityId: String(lead._id),
      vendorId: String(lead.vendorId),
      actorUserId: authUser.id,
      event: "PAYMENT_LINK_SENT",
      message: "Payment link sent to customer on WhatsApp",
      metadata: {
        paymentRequestId: String(paymentRequest._id),
      },
    });

    return updated;
  },

  sendBookingBalancePaymentLinkToCustomer: async (
    bookingId: string,
    paymentRequestId: string,
    payload: { notes?: string },
    authUser: AuthUser,
  ) => {
    const booking = await ensureBookingAccess(bookingId, authUser);
    const paymentRequest = await paymentRequestRepository.findById(paymentRequestId);
    if (!paymentRequest || String(paymentRequest.bookingId || "") !== String(booking._id)) {
      throw new ApiError(404, "Payment request not found for this booking");
    }

    const { customerName, customerMobile, customerEmail } = await resolveBookingCustomerContact(
      booking.toObject() as Record<string, unknown>,
    );

    if (
      String((booking as { customerName?: unknown }).customerName || "").trim() !== customerName ||
      String((booking as { customerMobile?: unknown }).customerMobile || "").trim() !==
        customerMobile ||
      String((booking as { customerEmail?: unknown }).customerEmail || "").trim() !== customerEmail
    ) {
      await bookingRepository.updateById(String(booking._id), {
        customerName,
        customerMobile,
        customerEmail,
      });
    }

    if (!customerMobile) {
      throw new ApiError(
        400,
        "Customer mobile number is required. Update customer mobile on lead or booking before sending payment link.",
      );
    }

    if (!String(paymentRequest.paymentLinkUrl || "").trim()) {
      throw new ApiError(400, "Payment link is not generated for this request");
    }

    const sentToWhatsapp = await trySendPaymentLinkWhatsapp({
      mobile: customerMobile,
      amount: Number(paymentRequest.requestedAmount || 0),
      paymentLink: String(paymentRequest.paymentLinkUrl || ""),
      notes: payload.notes || String(paymentRequest.notes || ""),
      customerName,
      customerEmail,
      packageName: String(paymentRequest.packageName || "Selected Package"),
      eventType: "Event",
      eventDate: booking.eventDate ? new Date(booking.eventDate) : undefined,
      functionTime: String(booking.eventSlot || ""),
    });

    const updated = await paymentRequestRepository.updateById(String(paymentRequest._id), {
      sentToWhatsapp,
    });

    await activityTimelineService.addEvent({
      entityType: "booking",
      entityId: String(booking._id),
      vendorId: String(booking.vendorId),
      actorUserId: authUser.id,
      event: "PAYMENT_LINK_SENT",
      message: "Balance payment link sent to customer on WhatsApp",
      metadata: {
        paymentRequestId: String(paymentRequest._id),
      },
    });

    return updated;
  },

  markBookingPaymentRequestReceived: async (
    bookingId: string,
    paymentRequestId: string,
    payload: { amount: number; note?: string },
    authUser: AuthUser,
  ) => {
    const booking = await ensureBookingAccess(bookingId, authUser);
    const paymentRequest = await paymentRequestRepository.findById(paymentRequestId);
    if (!paymentRequest || String(paymentRequest.bookingId || "") !== String(booking._id)) {
      throw new ApiError(404, "Payment request not found for this booking");
    }

    const amount = Number(payload.amount || 0);
    if (!Number.isFinite(amount) || amount <= 0) {
      throw new ApiError(400, "amount must be greater than zero");
    }

    const currentStatus = String(paymentRequest.status || "").toLowerCase();
    if (currentStatus === "paid") {
      const refreshedBooking = await bookingRepository.findById(String(booking._id));
      return {
        paymentRequest,
        booking: refreshedBooking || booking,
      };
    }

    if (!["pending", "failed"].includes(currentStatus)) {
      throw new ApiError(409, "Only pending or failed payment requests can be marked received");
    }

    const requestedAmount = Number(paymentRequest.requestedAmount || 0);
    if (!requestedAmount || requestedAmount <= 0) {
      throw new ApiError(400, "Invalid payment request amount for receive confirmation");
    }

    if (amount > requestedAmount) {
      throw new ApiError(400, "Received amount cannot exceed requested amount");
    }

    const totalAmount = Number(booking.amount || 0);
    const existingPaid = Number(booking.paidAmount || booking.advancePaid || 0);
    const currentDue =
      booking.dueAmount !== undefined
        ? Number(booking.dueAmount)
        : Math.max(0, totalAmount - existingPaid);
    const effectiveDue = Math.max(0, currentDue);
    const appliedAmount = Math.min(amount, requestedAmount, effectiveDue);

    const note = String(payload.note || "").trim();
    const now = new Date();
    const updatedRequest = await paymentRequestRepository.updateById(String(paymentRequest._id), {
      status: "paid",
      paidAmount: appliedAmount,
      notes: note || String(paymentRequest.notes || ""),
      metadata: {
        ...((paymentRequest.metadata as Record<string, unknown>) || {}),
        receiveMode: "MANUAL_CONFIRMATION",
        receiveConfirmedByUserId: authUser.id,
        receiveConfirmedAt: now.toISOString(),
        receiveNote: note,
        receiveRequestedAmount: amount,
        receiveAppliedAmount: appliedAmount,
      },
    });

    const updatedBooking =
      appliedAmount > 0
        ? await applyPaymentToBooking(String(booking._id), appliedAmount)
        : await bookingRepository.findById(String(booking._id));

    await activityTimelineService.addEvent({
      entityType: "booking",
      entityId: String(booking._id),
      vendorId: String(booking.vendorId),
      actorUserId: authUser.id,
      event: "PAYMENT_MARKED_RECEIVED",
      message: "Payment request manually marked as received",
      metadata: {
        paymentRequestId: String(paymentRequest._id),
        requestedAmount: amount,
        appliedAmount,
        note,
      },
    });

    return {
      paymentRequest: updatedRequest,
      booking: updatedBooking,
    };
  },

  recordManualAdvancePaymentForLead: async (
    leadId: string,
    payload: {
      packageId: string;
      packageName?: string;
      finalAmount: number;
      paidAmount: number;
      notes?: string;
      markBooked?: boolean;
    },
    authUser: AuthUser,
  ) => {
    const lead = await ensureLeadAccess(leadId, authUser);
    const existingBooking = await bookingRepository.findByLeadId(leadId);
    if (payload.markBooked && existingBooking) {
      return { paymentRequest: null, booking: existingBooking };
    }

    if (!Number.isFinite(payload.finalAmount) || payload.finalAmount <= 0) {
      throw new ApiError(400, "finalAmount must be greater than zero");
    }

    if (!Number.isFinite(payload.paidAmount) || payload.paidAmount <= 0) {
      throw new ApiError(400, "paidAmount must be greater than zero");
    }

    if (payload.paidAmount > payload.finalAmount) {
      throw new ApiError(400, "paidAmount cannot exceed finalAmount");
    }

    const latestPendingAdvance =
      await paymentRequestRepository.findLatestPendingAdvanceByLeadId(leadId);
    const configuredAdvanceAmount = Number(latestPendingAdvance?.requestedAmount || 0);
    if (configuredAdvanceAmount > 0 && payload.paidAmount > configuredAdvanceAmount) {
      throw new ApiError(400, "paidAmount cannot exceed configured advance amount");
    }

    const paymentRequest = await paymentRequestRepository.create({
      leadId: lead._id,
      vendorId: lead.vendorId,
      customerId: lead.customerId ?? null,
      packageId: payload.packageId,
      packageName: payload.packageName || lead.venuePackageName || "",
      paymentType: "ADVANCE",
      status: "paid",
      finalAmount: payload.finalAmount,
      requestedAmount: payload.paidAmount,
      paidAmount: payload.paidAmount,
      notes: payload.notes || "",
      metadata: {
        source: "MANUAL_ADVANCE_PAYMENT",
      },
    });

    await leadRepository.updateById(leadId, {
      packageId: payload.packageId,
      venuePackageName: payload.packageName || lead.venuePackageName || "",
      quoteAmount: payload.finalAmount,
      paymentStatus: payload.paidAmount >= payload.finalAmount ? "paid" : "pending",
      status: payload.markBooked ? "BOOKED" : "PAYMENT_DONE",
    });

    let booking = null;
    if (payload.markBooked) {
      booking = await paymentRequestService.finalizeLeadAsBooked(leadId, authUser);
    }

    await activityTimelineService.addEvent({
      entityType: "lead",
      entityId: String(lead._id),
      vendorId: String(lead.vendorId),
      actorUserId: authUser.id,
      event: "MANUAL_PAYMENT_RECORDED",
      message: "Manual advance payment recorded",
      metadata: {
        paymentRequestId: String(paymentRequest._id),
        paidAmount: payload.paidAmount,
      },
    });

    return { paymentRequest, booking };
  },

  markLeadAdvanceReceived: async (
    leadId: string,
    payload: { note?: string },
    authUser: AuthUser,
  ) => {
    const lead = await ensureLeadAccess(leadId, authUser);

    if (!String(lead.paymentLink || "").trim()) {
      throw new ApiError(
        400,
        "No payment link has been generated for this lead. Use 'Record Advance' for manual/cash payments.",
      );
    }

    if (lead.status === "BOOKED") {
      throw new ApiError(400, "This lead is already booked.");
    }

    if (lead.paymentStatus === "paid" && lead.status === "PAYMENT_DONE") {
      const paidAdvance = await paymentRequestRepository.findLatestPaidAdvanceByLeadId(leadId);
      if (paidAdvance) {
        return { paymentRequest: paidAdvance, alreadyConfirmed: true };
      }
    }

    const pendingAdvance = await paymentRequestRepository.findLatestPendingAdvanceByLeadId(leadId);
    if (!pendingAdvance) {
      throw new ApiError(
        404,
        "No pending advance request found. The advance may have already been confirmed via Razorpay webhook — refresh and try converting to booking.",
      );
    }

    const requestedAmount = Number(pendingAdvance.requestedAmount || 0);
    if (requestedAmount <= 0) {
      throw new ApiError(400, "Advance request amount is invalid. Cannot confirm receipt.");
    }

    const note = String(payload.note || "").trim();
    const now = new Date();

    const updatedRequest = await paymentRequestRepository.updateById(String(pendingAdvance._id), {
      status: "paid",
      paidAmount: requestedAmount,
      metadata: {
        ...((pendingAdvance.metadata as Record<string, unknown>) || {}),
        receiveMode: "MANUAL_CONFIRMATION",
        receiveConfirmedByUserId: authUser.id,
        receiveConfirmedAt: now.toISOString(),
        receiveNote: note,
      },
    });

    await leadRepository.updateById(leadId, {
      paymentStatus: "paid",
      status: "PAYMENT_DONE",
    });

    await activityTimelineService.addEvent({
      entityType: "lead",
      entityId: String(lead._id),
      vendorId: String(lead.vendorId),
      actorUserId: authUser.id,
      event: "PAYMENT_MARKED_RECEIVED",
      message: "Advance payment manually confirmed (payment link screenshot received)",
      metadata: {
        paymentRequestId: String(pendingAdvance._id),
        paidAmount: requestedAmount,
        note,
      },
    });

    return { paymentRequest: updatedRequest, alreadyConfirmed: false };
  },

  finalizeLeadAsBooked: async (leadId: string, authUser: AuthUser) => {
    const lead = await ensureLeadAccess(leadId, authUser);
    const existingBooking = await bookingRepository.findByLeadId(leadId);
    if (existingBooking) {
      await leadRepository.updateById(leadId, {
        status: "BOOKED",
      });
      return existingBooking;
    }

    const latestPaidAdvance = await paymentRequestRepository.findLatestPaidAdvanceByLeadId(leadId);

    if (!latestPaidAdvance) {
      throw new ApiError(
        400,
        "No paid advance found. Send quote payment link and wait for payment, or record manual advance before marking booked.",
      );
    }

    const latestAdvance = await paymentRequestRepository.findLatestAdvanceByLeadId(leadId);
    const resolvedPackageId =
      latestPaidAdvance.packageId || lead.packageId || latestAdvance?.packageId || null;

    if (!resolvedPackageId) {
      throw new ApiError(
        400,
        "Paid advance found, but package is missing. Select package and resend quote or record manual advance before converting.",
      );
    }

    const isPaid = true;
    const totalAmount = Number(
      latestPaidAdvance.finalAmount || latestAdvance?.finalAmount || lead.quoteAmount || 0,
    );
    const webhookOrManualPaidAmount = Number(latestPaidAdvance.paidAmount || 0);
    const paidAmount = Math.max(0, webhookOrManualPaidAmount);
    const dueAmount = Math.max(0, totalAmount - paidAmount);
    const bookingPaymentStatus = isPaid && dueAmount <= 0 ? "paid" : "pending";
    const customerMobile =
      String(lead.customerMobile || "").trim() ||
      normalizeMobile(extractFromMessage(String(lead.message || ""), "Mobile"));
    const customerName =
      String(lead.customerName || "").trim() ||
      extractFromMessage(String(lead.message || ""), "Customer") ||
      "Customer";
    const customerEmail =
      String(lead.customerEmail || "").trim() ||
      extractFromMessage(String(lead.message || ""), "Email");

    await bookingPolicyService.assertBookingConflictFree({
      vendorId: String(lead.vendorId),
      packageId: String(resolvedPackageId),
      eventDate: new Date(lead.eventDate),
      venueOwnerId: lead.venueOwnerId ? String(lead.venueOwnerId) : null,
      customerId: lead.customerId ? String(lead.customerId) : "",
      customerMobile,
    });

    const booking = await bookingRepository.create({
      customerId: lead.customerId ?? null,
      customerName,
      customerMobile,
      customerEmail,
      vendorId: lead.vendorId,
      leadId: lead._id,
      packageId: resolvedPackageId,
      eventDate: lead.eventDate,
      eventSlot: lead.eventSlot,
      amount: totalAmount,
      advancePaid: paidAmount,
      paidAmount,
      dueAmount,
      paymentStatus: bookingPaymentStatus,
      bookingStatus: "upcoming",
      vendorAmount: totalAmount,
      settledAmount: 0,
      pendingSettlement: totalAmount,
      settlementStatus: "PENDING",
      referralCode: String(lead.referralCode || ""),
      referralVendorId: lead.referralVendorId ?? null,
    });

    await leadRepository.updateById(leadId, {
      status: "BOOKED",
      paymentStatus: bookingPaymentStatus,
      packageId: resolvedPackageId,
      quoteAmount: totalAmount,
    });

    await paymentRequestRepository.updateById(String(latestPaidAdvance._id), {
      packageId: resolvedPackageId,
      bookingId: (booking as { _id?: unknown })._id,
    });

    if (booking.eventDate && booking.eventSlot) {
      await availabilityRepository.upsertSlot({
        vendorId: String(booking.vendorId),
        date: new Date(booking.eventDate),
        slot: String(booking.eventSlot),
        status: "booked",
      });
    }

    await activityTimelineService.addEvent({
      entityType: "booking",
      entityId: String((booking as { _id?: unknown })._id || ""),
      vendorId: String(lead.vendorId),
      actorUserId: authUser.id,
      event: "BOOKING_CONFIRMED",
      message: "Booking confirmed by vendor/venue owner",
      metadata: {
        leadId: String(lead._id),
        advanceSource: isPaid ? "PAID_ADVANCE" : "ADVANCE_LINK_REQUESTED",
        advanceAmountUsed: paidAmount,
      },
    });

    const mobile =
      normalizeMobile(String(lead.customerMobile || "")) ||
      normalizeMobile(extractFromMessage(String(lead.message || ""), "Mobile"));
    if (mobile) {
      await trySendBookingConfirmedWhatsapp({
        mobile,
        bookingId: String((booking as { _id?: unknown })._id || ""),
        customerName,
        packageName: String(
          latestPaidAdvance.packageName ||
            latestAdvance?.packageName ||
            lead.venuePackageName ||
            "",
        ),
        eventDate: lead.eventDate ? new Date(lead.eventDate) : undefined,
      });
    }

    return booking;
  },

  createBalanceRequestForBooking: async (
    bookingId: string,
    payload: CreateBalancePayload,
    authUser: AuthUser,
  ) => {
    const booking = await ensureBookingAccess(bookingId, authUser);

    if (!Number.isFinite(payload.amount) || payload.amount <= 0) {
      throw new ApiError(400, "amount must be greater than zero");
    }

    const { customerName, customerMobile, customerEmail } = await resolveBookingCustomerContact(
      booking.toObject() as Record<string, unknown>,
    );

    const payloadCustomerMobile = normalizeMobile(String(payload.customerMobile || ""));
    const effectiveCustomerMobile = customerMobile || payloadCustomerMobile;

    if (!effectiveCustomerMobile) {
      throw new ApiError(
        400,
        "Customer mobile number is required. Update customer mobile on lead or booking before generating balance link.",
      );
    }

    if (
      String((booking as { customerName?: unknown }).customerName || "").trim() !== customerName ||
      String((booking as { customerMobile?: unknown }).customerMobile || "").trim() !==
        effectiveCustomerMobile ||
      String((booking as { customerEmail?: unknown }).customerEmail || "").trim() !== customerEmail
    ) {
      await bookingRepository.updateById(String(booking._id), {
        customerName,
        customerMobile: effectiveCustomerMobile,
        customerEmail,
      });
    }

    const paymentType = payload.paymentType || "BALANCE";
    const paymentExpiryDate = safeDate(payload.paymentExpiry);
    const referenceId = buildRazorpayReferenceId("booking", String(booking._id));

    let paymentLink: { id: string; shortUrl: string; referenceId: string };
    try {
      paymentLink = await createRazorpayPaymentLink({
        customerName,
        customerMobile: effectiveCustomerMobile,
        customerEmail,
        amount: payload.amount,
        referenceId,
        expiryEpochSeconds: paymentExpiryDate
          ? Math.floor(paymentExpiryDate.getTime() / 1000)
          : undefined,
        notes: {
          bookingId: String(booking._id),
          paymentType,
        },
      });
    } catch (error) {
      const normalizedError = toPaymentLinkApiError(error);
      logger.error(
        {
          event: "payment.link.create_failed",
          bookingId: String(booking._id),
          referenceId,
          statusCode: extractErrorStatusCode(error),
          errorMessage: extractErrorMessage(error),
          error,
        },
        "Razorpay balance payment link creation failed",
      );
      throw normalizedError;
    }

    if (!paymentLink.id || !paymentLink.shortUrl) {
      logger.error(
        {
          event: "payment.link.invalid_response",
          bookingId: String(booking._id),
          referenceId,
          response: paymentLink,
        },
        "Razorpay payment link response is missing required fields",
      );
      throw new ApiError(502, "Unable to generate payment link. Please try again.");
    }

    const sentToWhatsapp =
      payload.sendWhatsApp === true
        ? await trySendPaymentLinkWhatsapp({
            mobile: effectiveCustomerMobile,
            amount: payload.amount,
            paymentLink: paymentLink.shortUrl,
            notes: payload.notes,
          })
        : false;

    const paymentRequest = await paymentRequestRepository.create({
      leadId: booking.leadId ?? null,
      bookingId: booking._id,
      vendorId: booking.vendorId,
      customerId: booking.customerId ?? null,
      packageId: booking.packageId,
      paymentType,
      status: "pending",
      finalAmount: Number(booking.amount || 0),
      requestedAmount: payload.amount,
      paidAmount: 0,
      notes: payload.notes || "",
      paymentExpiry: paymentExpiryDate,
      razorpayPaymentLinkId: paymentLink.id,
      razorpayReferenceId: paymentLink.referenceId,
      paymentLinkUrl: paymentLink.shortUrl,
      sentToWhatsapp,
      metadata: {
        source: "BOOKING_BALANCE_REQUEST",
      },
    });

    await activityTimelineService.addEvent({
      entityType: "booking",
      entityId: String(booking._id),
      vendorId: String(booking.vendorId),
      actorUserId: authUser.id,
      event: "BALANCE_REQUESTED",
      message: "Balance payment link generated",
      metadata: {
        paymentRequestId: String(paymentRequest._id),
        amount: payload.amount,
        paymentType,
      },
    });

    return paymentRequest;
  },

  recordManualPaymentForBooking: async (
    bookingId: string,
    payload: RecordManualBookingPaymentPayload,
    authUser: AuthUser,
  ) => {
    const booking = await ensureBookingAccess(bookingId, authUser);

    if (!Number.isFinite(payload.amount) || payload.amount <= 0) {
      throw new ApiError(400, "amount must be greater than zero");
    }

    const totalAmount = Number(booking.amount || 0);
    const existingPaid = Number(booking.paidAmount || booking.advancePaid || 0);
    const existingDue =
      booking.dueAmount !== undefined
        ? Number(booking.dueAmount)
        : Math.max(0, totalAmount - existingPaid);

    if (payload.amount > existingDue) {
      throw new ApiError(400, "Manual payment amount cannot exceed current due amount");
    }

    const paymentType = payload.paymentType || "BALANCE";
    const paymentRequest = await paymentRequestRepository.create({
      leadId: booking.leadId ?? null,
      bookingId: booking._id,
      vendorId: booking.vendorId,
      customerId: booking.customerId ?? null,
      packageId: booking.packageId,
      paymentType,
      status: "paid",
      finalAmount: totalAmount,
      requestedAmount: payload.amount,
      paidAmount: payload.amount,
      notes: payload.notes || "",
      metadata: {
        source: "MANUAL_BOOKING_PAYMENT",
      },
    });

    const updatedBooking = await applyPaymentToBooking(String(booking._id), payload.amount);

    await activityTimelineService.addEvent({
      entityType: "booking",
      entityId: String(booking._id),
      vendorId: String(booking.vendorId),
      actorUserId: authUser.id,
      event: "MANUAL_PAYMENT_RECORDED",
      message: "Manual payment recorded for booking",
      metadata: {
        paymentRequestId: String(paymentRequest._id),
        paymentType,
        paidAmount: payload.amount,
      },
    });

    return {
      paymentRequest,
      booking: updatedBooking,
    };
  },

  processRazorpayWebhook: async (rawBody: Buffer, signatureHeader: string) => {
    const { credentials } = buildRazorpayClient();
    if (!credentials.webhookSecret) {
      return { handled: false, reason: "webhook_secret_missing" };
    }

    const providedSignature = String(signatureHeader || "").trim();
    if (!/^[a-fA-F0-9]{64}$/.test(providedSignature)) {
      throw new ApiError(401, "Invalid webhook signature");
    }

    const expectedDigest = crypto
      .createHmac("sha256", credentials.webhookSecret)
      .update(rawBody)
      .digest();
    const providedDigest = Buffer.from(providedSignature, "hex");
    if (
      providedDigest.length !== expectedDigest.length ||
      !crypto.timingSafeEqual(providedDigest, expectedDigest)
    ) {
      throw new ApiError(401, "Invalid webhook signature");
    }

    const payload = JSON.parse(rawBody.toString("utf8")) as {
      event?: string;
      created_at?: number;
      payload?: Record<string, unknown>;
    };

    const eventType = String(payload.event || "").trim();
    if (!eventType) {
      throw new ApiError(400, "Webhook event type is missing");
    }

    const paidEventTypes = new Set(["payment_link.paid", "payment.captured", "order.paid"]);
    if (!paidEventTypes.has(eventType)) {
      return { handled: false, reason: "unsupported_event_type", eventType };
    }

    const webhookEventId = (() => {
      const rootPayload = payload.payload || {};
      const paymentLinkEntity =
        rootPayload.payment_link && typeof rootPayload.payment_link === "object"
          ? ((rootPayload.payment_link as Record<string, unknown>).entity as
              | Record<string, unknown>
              | undefined)
          : undefined;
      const paymentEntity =
        rootPayload.payment && typeof rootPayload.payment === "object"
          ? ((rootPayload.payment as Record<string, unknown>).entity as
              | Record<string, unknown>
              | undefined)
          : undefined;

      return String(
        paymentEntity?.id ||
          paymentLinkEntity?.id ||
          `${eventType}:${String(payload.created_at || Date.now())}:${crypto
            .createHash("sha1")
            .update(rawBody)
            .digest("hex")}`,
      );
    })();

    const payloadHash = crypto.createHash("sha256").update(rawBody).digest("hex");
    const markResult = await subscriptionRepository.markWebhookEventProcessed(
      webhookEventId,
      eventType,
      payloadHash,
    );
    if (!markResult) {
      return { handled: true, duplicate: true };
    }

    const rootPayload = payload.payload || {};
    const paymentLinkEntity =
      rootPayload.payment_link && typeof rootPayload.payment_link === "object"
        ? ((rootPayload.payment_link as Record<string, unknown>).entity as
            | Record<string, unknown>
            | undefined)
        : undefined;
    const paymentEntity =
      rootPayload.payment && typeof rootPayload.payment === "object"
        ? ((rootPayload.payment as Record<string, unknown>).entity as
            | Record<string, unknown>
            | undefined)
        : undefined;

    const referenceId = String(
      paymentLinkEntity?.reference_id ||
        (paymentEntity?.notes && typeof paymentEntity.notes === "object"
          ? (paymentEntity.notes as Record<string, unknown>).paymentRequestId
          : "") ||
        "",
    ).trim();

    const paymentLinkId = String(paymentLinkEntity?.id || paymentEntity?.order_id || "").trim();

    const paymentNotes = (() => {
      if (paymentEntity?.notes && typeof paymentEntity.notes === "object") {
        return paymentEntity.notes as Record<string, unknown>;
      }

      if (paymentLinkEntity?.notes && typeof paymentLinkEntity.notes === "object") {
        return paymentLinkEntity.notes as Record<string, unknown>;
      }

      return {} as Record<string, unknown>;
    })();

    let paymentRequest = referenceId
      ? await paymentRequestRepository.findByRazorpayReferenceId(referenceId)
      : null;
    if (!paymentRequest && paymentLinkId) {
      paymentRequest = await paymentRequestRepository.findByRazorpayPaymentLinkId(paymentLinkId);
    }

    if (!paymentRequest) {
      const noteLeadId = String(paymentNotes.leadId || "").trim();
      const noteBookingId = String(paymentNotes.bookingId || "").trim();
      const notePaymentType = String(paymentNotes.paymentType || "")
        .trim()
        .toUpperCase();

      if (noteLeadId && notePaymentType === "ADVANCE") {
        paymentRequest =
          await paymentRequestRepository.findLatestPendingAdvanceByLeadId(noteLeadId);
      }

      if (!paymentRequest && noteBookingId) {
        paymentRequest = await paymentRequestRepository.findLatestPendingByBookingId(noteBookingId);
      }
    }

    if (!paymentRequest) {
      return { handled: false, reason: "payment_request_not_found" };
    }

    const paidAmountPaise = Number(paymentLinkEntity?.amount_paid || paymentEntity?.amount || 0);
    const paidAmount = Math.max(
      0,
      paidAmountPaise > 0 ? paidAmountPaise / 100 : Number(paymentRequest.requestedAmount || 0),
    );

    const updatedRequest = await paymentRequestRepository.updateByIdempotentWebhook(
      String(paymentRequest._id),
      webhookEventId,
      {
        status: "paid",
        paidAmount,
        razorpayPaymentId: String(paymentEntity?.id || paymentLinkEntity?.payment_id || ""),
      },
    );

    if (!updatedRequest) {
      return { handled: true, duplicate: true };
    }

    await activityTimelineService.addEvent({
      entityType: "payment_request",
      entityId: String(updatedRequest._id),
      vendorId: String(updatedRequest.vendorId),
      event: "PAYMENT_SUCCESS",
      message: "Payment captured via Razorpay webhook",
      metadata: {
        webhookEventId,
        paidAmount,
        paymentType: String(updatedRequest.paymentType),
      },
    });

    if (String(updatedRequest.paymentType) === "ADVANCE" && updatedRequest.leadId) {
      await leadRepository.updateById(String(updatedRequest.leadId), {
        status: "PAYMENT_DONE",
        paymentStatus:
          Number(updatedRequest.paidAmount || 0) >= Number(updatedRequest.finalAmount || 0)
            ? "paid"
            : "pending",
      });
    }

    if (updatedRequest.bookingId) {
      await applyPaymentToBooking(String(updatedRequest.bookingId), paidAmount);
    }

    return {
      handled: true,
      paymentRequestId: String(updatedRequest._id),
    };
  },
};
