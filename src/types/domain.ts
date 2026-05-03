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
  "initiated",
  "confirmed",
  "cancelled",
  "completed",
] as const;
export type BookingStatus = (typeof BOOKING_STATUSES)[number];
