import { VendorModel } from "../models/vendor.model";

const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

export const vendorRepository = {
  create: (payload: Record<string, unknown>) => VendorModel.create(payload),
  findByEmailOrMobile: (email: string, mobile: string) =>
    VendorModel.findOne({
      $or: [{ email: email.toLowerCase() }, { mobile: mobile.trim() }],
    }),
  findAll: (filters: Record<string, unknown> = {}) => {
    const query: Record<string, unknown> = {};
    const includeInactive = filters.includeInactive === true;

    if (!includeInactive) {
      query.isActive = true;
      query.approvalStatus = "active";
    }

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

    if (typeof filters.approvalStatus === "string" && filters.approvalStatus.trim()) {
      query.approvalStatus = filters.approvalStatus.trim();
    }

    const limit = typeof filters.limit === "number" ? Math.max(1, Math.min(100, filters.limit)) : 50;

    return VendorModel.find(query).sort({ createdAt: -1 }).limit(limit);
  },
  findById: (id: string) => VendorModel.findById(id),
  updateById: (id: string, payload: Record<string, unknown>) =>
    VendorModel.findByIdAndUpdate(id, payload, { new: true }),
  deleteById: (id: string) => VendorModel.findByIdAndDelete(id),
};
