export const USER_ROLES = [
  "customer",
  "vendor",
  "venue_owner",
  "super_admin",
  "vendor_admin",
  "accounts_admin",
] as const;

export type UserRole = (typeof USER_ROLES)[number];

export const LEAD_STATUSES = [
  "NEW",
  "CONTACTED",
  "PAYMENT_DONE",
  "BOOKED",
  "LOST",
  // Legacy states kept for backward compatibility with existing records.
  "NEGOTIATION",
  "QUOTE_SENT",
  "PAYMENT_PENDING",
  "PAID",
  "CONFIRMED",
  "COMPLETED",
  "CANCELLED",
] as const;

export type LeadStatus = (typeof LEAD_STATUSES)[number];

export const AVAILABILITY_STATUSES = [
  "available",
  "blocked",
  "tentative",
  "booked",
  "holiday",
] as const;

export type AvailabilityStatus = (typeof AVAILABILITY_STATUSES)[number];

export const PAYMENT_STATUSES = ["pending", "paid", "failed", "refunded"] as const;
export type PaymentStatus = (typeof PAYMENT_STATUSES)[number];

export const BOOKING_STATUSES = [
  "upcoming",
  "completed",
  "cancelled",
  // Legacy states kept for backward compatibility with existing records.
  "initiated",
  "confirmed",
] as const;
export type BookingStatus = (typeof BOOKING_STATUSES)[number];

export const PAYMENT_REQUEST_TYPES = ["ADVANCE", "BALANCE", "EXTRA"] as const;
export type PaymentRequestType = (typeof PAYMENT_REQUEST_TYPES)[number];

export const SETTLEMENT_STATUSES = ["PENDING", "SETTLED"] as const;
export type SettlementStatus = (typeof SETTLEMENT_STATUSES)[number];

export const LEAD_SOURCES = ["WEBSITE", "PHONE", "WHATSAPP", "INSTAGRAM", "REFERRAL", "MANUAL"] as const;
export type LeadSource = (typeof LEAD_SOURCES)[number];
