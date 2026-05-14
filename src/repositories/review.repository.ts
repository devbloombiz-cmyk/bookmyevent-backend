import { Types } from "mongoose";
import { ReviewModel } from "../models/review.model";

const toObjectId = (value: string) => new Types.ObjectId(value);

export const reviewRepository = {
  create: (payload: Record<string, unknown>) => ReviewModel.create(payload),
  findByBookingId: (bookingId: string) => ReviewModel.findOne({ bookingId }),
  findPublicBySubject: (params: {
    subjectType: "vendor" | "venue_owner";
    subjectId: string;
    page: number;
    limit: number;
    rating?: number;
  }) => {
    const query: Record<string, unknown> = {
      subjectType: params.subjectType,
      subjectId: params.subjectId,
      isActive: true,
    };

    if (typeof params.rating === "number") {
      query.rating = params.rating;
    }

    return ReviewModel.find(query)
      .sort({ createdAt: -1 })
      .skip((params.page - 1) * params.limit)
      .limit(params.limit)
      .lean();
  },
  countPublicBySubject: (params: {
    subjectType: "vendor" | "venue_owner";
    subjectId: string;
    rating?: number;
  }) => {
    const query: Record<string, unknown> = {
      subjectType: params.subjectType,
      subjectId: params.subjectId,
      isActive: true,
    };

    if (typeof params.rating === "number") {
      query.rating = params.rating;
    }

    return ReviewModel.countDocuments(query);
  },
  summarizeBySubject: async (subjectType: "vendor" | "venue_owner", subjectId: string) => {
    const [row] = await ReviewModel.aggregate<{ _id: null; avgRating: number; totalReviews: number }>([
      {
        $match: {
          subjectType,
          subjectId: toObjectId(subjectId),
          isActive: true,
        },
      },
      {
        $group: {
          _id: null,
          avgRating: { $avg: "$rating" },
          totalReviews: { $sum: 1 },
        },
      },
    ]);

    return {
      avgRating: Number((row?.avgRating ?? 0).toFixed(1)),
      totalReviews: row?.totalReviews ?? 0,
    };
  },
  ratingBreakdownBySubject: async (subjectType: "vendor" | "venue_owner", subjectId: string) => {
    const rows = await ReviewModel.aggregate<{ _id: number; count: number }>([
      {
        $match: {
          subjectType,
          subjectId: toObjectId(subjectId),
          isActive: true,
        },
      },
      {
        $group: {
          _id: "$rating",
          count: { $sum: 1 },
        },
      },
    ]);

    const breakdown: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    for (const row of rows) {
      breakdown[row._id] = row.count;
    }

    return breakdown;
  },
  listForOwnerDashboard: (params: {
    subjectType: "vendor" | "venue_owner";
    subjectId: string;
    page: number;
    limit: number;
    search?: string;
    rating?: number;
  }) => {
    const query: Record<string, unknown> = {
      subjectType: params.subjectType,
      subjectId: params.subjectId,
      isActive: true,
    };

    if (typeof params.rating === "number") {
      query.rating = params.rating;
    }

    if (params.search) {
      query.$or = [
        { title: { $regex: params.search, $options: "i" } },
        { message: { $regex: params.search, $options: "i" } },
        { customerName: { $regex: params.search, $options: "i" } },
      ];
    }

    return ReviewModel.find(query)
      .sort({ createdAt: -1 })
      .skip((params.page - 1) * params.limit)
      .limit(params.limit)
      .lean();
  },
  countForOwnerDashboard: (params: {
    subjectType: "vendor" | "venue_owner";
    subjectId: string;
    search?: string;
    rating?: number;
  }) => {
    const query: Record<string, unknown> = {
      subjectType: params.subjectType,
      subjectId: params.subjectId,
      isActive: true,
    };

    if (typeof params.rating === "number") {
      query.rating = params.rating;
    }

    if (params.search) {
      query.$or = [
        { title: { $regex: params.search, $options: "i" } },
        { message: { $regex: params.search, $options: "i" } },
        { customerName: { $regex: params.search, $options: "i" } },
      ];
    }

    return ReviewModel.countDocuments(query);
  },
};
