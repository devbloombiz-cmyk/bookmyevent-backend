import { BookingModel } from "../models/booking.model";

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
  findByLeadId: (leadId: string) => BookingModel.findOne({ leadId }),
  updateById: (bookingId: string, payload: Record<string, unknown>) =>
    BookingModel.findByIdAndUpdate(bookingId, payload, { returnDocument: "after" }),
};
