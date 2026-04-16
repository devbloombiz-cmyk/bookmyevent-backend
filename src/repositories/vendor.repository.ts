import { VendorModel } from "../models/vendor.model";

const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

export const vendorRepository = {
  create: (payload: Record<string, unknown>) => VendorModel.create(payload),
  findAll: (filters: Record<string, unknown> = {}) => {
    const query: Record<string, unknown> = {};

    if (typeof filters.category === "string" && filters.category.trim()) {
      query.category = new RegExp(`^${escapeRegExp(filters.category.trim())}$`, "i");
    }

    if (typeof filters.subCategory === "string" && filters.subCategory.trim()) {
      query.subCategory = new RegExp(`^${escapeRegExp(filters.subCategory.trim())}$`, "i");
    }

    if (typeof filters.state === "string" && filters.state.trim()) {
      query.state = new RegExp(`^${escapeRegExp(filters.state.trim())}$`, "i");
    }

    if (typeof filters.district === "string" && filters.district.trim()) {
      query.district = new RegExp(`^${escapeRegExp(filters.district.trim())}$`, "i");
    }

    if (typeof filters.city === "string" && filters.city.trim()) {
      query.city = new RegExp(`^${escapeRegExp(filters.city.trim())}$`, "i");
    }

    if (typeof filters.isVerified === "boolean") {
      query.isVerified = filters.isVerified;
    }

    const limit = typeof filters.limit === "number" ? Math.max(1, Math.min(100, filters.limit)) : 50;

    return VendorModel.find(query).sort({ createdAt: -1 }).limit(limit);
  },
  findById: (id: string) => VendorModel.findById(id),
};
