import { VendorModel } from "../models/vendor.model";

const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

export const vendorRepository = {
  create: (payload: Record<string, unknown>) => VendorModel.create(payload),
  findByUserId: (userId: string) => VendorModel.findOne({ userId }),
  findByIds: (ids: string[]) =>
    VendorModel.find({
      _id: { $in: ids },
    }),
  findByReferralCode: (referralCode: string) =>
    VendorModel.findOne({
      referralCode: String(referralCode || "")
        .trim()
        .toUpperCase(),
      profileType: { $ne: "venue_owner_shadow" },
    }),
  findByEmailOrMobile: (email?: string | null, mobile?: string | null) => {
    const normalizedEmail = typeof email === "string" ? email.trim().toLowerCase() : "";
    const normalizedMobile = typeof mobile === "string" ? mobile.trim() : "";
    const conditions: Array<Record<string, string>> = [];

    if (normalizedEmail) {
      conditions.push({ email: normalizedEmail });
    }

    if (normalizedMobile) {
      conditions.push({ mobile: normalizedMobile });
    }

    if (!conditions.length) {
      return Promise.resolve(null);
    }

    return VendorModel.findOne({
      $or: conditions,
    });
  },
  findAll: (filters: Record<string, unknown> = {}) => {
    const query: Record<string, unknown> = {};
    const includeInactive = filters.includeInactive === true || filters.includeInactive === "true";
    query.profileType = { $ne: "venue_owner_shadow" };

    if (!includeInactive) {
      query.isActive = true;
      query.approvalStatus = "active";
    }

    if (typeof filters.category === "string" && filters.category.trim()) {
      query.category = filters.category.trim();
    }

    if (typeof filters.subCategory === "string" && filters.subCategory.trim()) {
      const subCategoryRegex = new RegExp(`^${escapeRegExp(filters.subCategory.trim())}$`, "i");
      const currentAnd = Array.isArray(query.$and) ? query.$and : [];
      query.$and = [
        ...currentAnd,
        {
          $or: [{ subCategory: subCategoryRegex }, { subCategories: { $in: [subCategoryRegex] } }],
        },
      ];
    }

    if (Array.isArray(filters.subCategories) && filters.subCategories.length) {
      const normalized = filters.subCategories
        .filter((item): item is string => typeof item === "string" && item.trim().length > 0)
        .map((item) => new RegExp(`^${escapeRegExp(item.trim())}$`, "i"));

      if (normalized.length) {
        const currentAnd = Array.isArray(query.$and) ? query.$and : [];
        query.$and = [
          ...currentAnd,
          {
            $or: [{ subCategory: { $in: normalized } }, { subCategories: { $in: normalized } }],
          },
        ];
      }
    }

    if (typeof filters.state === "string" && filters.state.trim()) {
      query.state = filters.state.trim();
    }

    if (typeof filters.district === "string" && filters.district.trim()) {
      const districtVal = filters.district.trim();
      const currentAnd = Array.isArray(query.$and) ? query.$and : [];
      query.$and = [
        ...currentAnd,
        {
          $or: [{ district: districtVal }, { serviceZones: districtVal }],
        },
      ];
    }

    if (typeof filters.city === "string" && filters.city.trim()) {
      query.city = filters.city.trim();
    }

    if (typeof filters.isVerified === "boolean") {
      query.isVerified = filters.isVerified;
    }

    if (typeof filters.approvalStatus === "string" && filters.approvalStatus.trim()) {
      const normalizedApprovalStatus = filters.approvalStatus.trim();
      if (normalizedApprovalStatus === "pending") {
        query.approvalStatus = { $in: ["pending", null, ""] };
      } else {
        query.approvalStatus = normalizedApprovalStatus;
      }
    }

    if (typeof filters.registrationSource === "string" && filters.registrationSource.trim()) {
      const source = filters.registrationSource.trim();
      if (source === "admin" || source === "public") {
        query.registrationSource = source;
      }
    }

    if (typeof filters.search === "string" && filters.search.trim()) {
      const searchRegex = new RegExp(escapeRegExp(filters.search.trim()), "i");
      query.$or = [
        { businessName: searchRegex },
        { ownerName: searchRegex },
        { category: searchRegex },
        { subCategory: searchRegex },
        { subCategories: { $in: [searchRegex] } },
        { city: searchRegex },
        { serviceZones: { $in: [searchRegex] } },
      ];
    }

    let limitVal = 50;
    if (typeof filters.limit === "number") {
      limitVal = filters.limit;
    } else if (typeof filters.limit === "string") {
      const parsed = parseInt(filters.limit, 10);
      if (!isNaN(parsed)) {
        limitVal = parsed;
      }
    }
    const limit = Math.max(1, Math.min(1000, limitVal));

    return VendorModel.find(query).sort({ createdAt: 1 }).limit(limit);
  },
  findById: (id: string) => VendorModel.findById(id),
  findByReferredByVendorId: (vendorId: string, limit = 200) =>
    VendorModel.find({
      referredByVendorId: vendorId,
      profileType: { $ne: "venue_owner_shadow" },
    })
      .sort({ createdAt: 1 })
      .limit(Math.max(1, Math.min(1000, limit))),
  findReferralAttributedVendors: (limit = 500) =>
    VendorModel.find({
      referredByVendorId: { $ne: null },
      profileType: { $ne: "venue_owner_shadow" },
    })
      .sort({ createdAt: 1 })
      .limit(Math.max(1, Math.min(2000, limit))),
  updateById: (id: string, payload: Record<string, unknown>) =>
    VendorModel.findByIdAndUpdate(id, payload, { returnDocument: "after" }),
  deleteById: (id: string) => VendorModel.findByIdAndDelete(id),
};
