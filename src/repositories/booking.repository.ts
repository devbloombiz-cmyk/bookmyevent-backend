import { BookingModel } from "../models/booking.model";

const toUtcDateRange = (value: Date) => {
  const normalized = new Date(value);
  const start = new Date(
    Date.UTC(
      normalized.getUTCFullYear(),
      normalized.getUTCMonth(),
      normalized.getUTCDate(),
      0,
      0,
      0,
      0,
    ),
  );
  const end = new Date(
    Date.UTC(
      normalized.getUTCFullYear(),
      normalized.getUTCMonth(),
      normalized.getUTCDate(),
      23,
      59,
      59,
      999,
    ),
  );

  return { start, end };
};

const normalizeId = (value?: string | null) => String(value || "").trim();
const normalizeMobile = (value?: string | null) =>
  String(value || "")
    .trim()
    .replace(/\D/g, "");

export const bookingRepository = {
  create: (payload: Record<string, unknown>) => BookingModel.create(payload),
  findAll: () => BookingModel.find().sort({ createdAt: -1 }),
  findByCustomer: (customerId: string) => BookingModel.find({ customerId }).sort({ createdAt: -1 }),
  findByVendor: (vendorId: string) => BookingModel.find({ vendorId }).sort({ createdAt: -1 }),
  findByReferralVendorId: (referralVendorId: string) =>
    BookingModel.find({ referralVendorId }).sort({ createdAt: -1 }),
  findAllWithReferral: (limit = 500) =>
    BookingModel.find({ referralVendorId: { $ne: null } })
      .sort({ createdAt: -1 })
      .limit(limit),
  aggregateReferralLeaderboard: (limit = 100) =>
    BookingModel.aggregate([
      {
        $match: {
          referralVendorId: { $ne: null },
        },
      },
      {
        $group: {
          _id: "$referralVendorId",
          totalReferrals: { $sum: 1 },
          completedReferrals: {
            $sum: {
              $cond: [{ $eq: ["$bookingStatus", "completed"] }, 1, 0],
            },
          },
          totalAmount: { $sum: { $ifNull: ["$amount", 0] } },
        },
      },
      {
        $sort: {
          totalReferrals: -1,
          totalAmount: -1,
        },
      },
      {
        $limit: Math.max(1, Math.min(500, Number(limit) || 100)),
      },
    ]),
  findById: (bookingId: string) => BookingModel.findById(bookingId),
  findByIds: (bookingIds: string[]) =>
    BookingModel.find({
      _id: {
        $in: bookingIds,
      },
    }),
  findByLeadId: (leadId: string) => BookingModel.findOne({ leadId }),
  findActiveByVendorAndDate: (
    vendorId: string,
    eventDate: Date,
    options?: { excludeBookingId?: string },
  ) => {
    const { start, end } = toUtcDateRange(eventDate);

    return BookingModel.findOne({
      vendorId,
      eventDate: { $gte: start, $lte: end },
      bookingStatus: { $ne: "cancelled" },
      ...(options?.excludeBookingId
        ? {
            _id: {
              $ne: options.excludeBookingId,
            },
          }
        : {}),
    });
  },
  findActiveByVendorPackageAndDate: (
    vendorId: string,
    packageId: string,
    eventDate: Date,
    options?: { excludeBookingId?: string },
  ) => {
    const { start, end } = toUtcDateRange(eventDate);

    return BookingModel.findOne({
      vendorId,
      packageId,
      eventDate: { $gte: start, $lte: end },
      bookingStatus: { $ne: "cancelled" },
      ...(options?.excludeBookingId
        ? {
            _id: {
              $ne: options.excludeBookingId,
            },
          }
        : {}),
    });
  },
  findActiveByVendorCustomerAndDate: (
    vendorId: string,
    eventDate: Date,
    options?: {
      customerId?: string | null;
      customerMobile?: string | null;
      excludeBookingId?: string;
    },
  ) => {
    const { start, end } = toUtcDateRange(eventDate);
    const normalizedCustomerId = normalizeId(options?.customerId);
    const normalizedCustomerMobile = normalizeMobile(options?.customerMobile);

    const customerFilters: Array<Record<string, unknown>> = [];
    if (normalizedCustomerId) {
      customerFilters.push({ customerId: normalizedCustomerId });
    }
    if (normalizedCustomerMobile) {
      customerFilters.push({ customerMobile: normalizedCustomerMobile });
    }

    if (!customerFilters.length) {
      return Promise.resolve(null);
    }

    return BookingModel.findOne({
      vendorId,
      eventDate: { $gte: start, $lte: end },
      bookingStatus: { $ne: "cancelled" },
      $or: customerFilters,
      ...(options?.excludeBookingId
        ? {
            _id: {
              $ne: options.excludeBookingId,
            },
          }
        : {}),
    });
  },
  updateById: (bookingId: string, payload: Record<string, unknown>) =>
    BookingModel.findByIdAndUpdate(bookingId, payload, { returnDocument: "after" }),
};
