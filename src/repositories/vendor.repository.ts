import { VendorModel } from "../models/vendor.model";

const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

export const vendorRepository = {
  create: (payload: Record<string, unknown>) => VendorModel.create(payload),
  findByUserId: (userId: string) => VendorModel.findOne({ userId }),
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
    const includeInactive =
      filters.includeInactive === true || String(filters.includeInactive || "") === "true";
    query.profileType = { $ne: "venue_owner_shadow" };

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
      const districtRegex = new RegExp(`^${escapeRegExp(filters.district.trim())}$`, "i");
      query.$or = [
        ...((query.$or as Record<string, unknown>[]) || []),
        {
          district: districtRegex,
        },
        {
          serviceZones: { $in: [districtRegex] },
        },
      ];
    }

    if (typeof filters.city === "string" && filters.city.trim()) {
      query.city = new RegExp(`^${escapeRegExp(filters.city.trim())}$`, "i");
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
      const searchableOr = [
        { businessName: searchRegex },
        { ownerName: searchRegex },
        { category: searchRegex },
        { subCategory: searchRegex },
        { city: searchRegex },
        { serviceZones: { $in: [searchRegex] } },
      ];

      if (Array.isArray(query.$or) && query.$or.length) {
        query.$and = [{ $or: query.$or }, { $or: searchableOr }];
        delete query.$or;
      } else {
        query.$or = searchableOr;
      }
    }

    const limit =
      typeof filters.limit === "number" ? Math.max(1, Math.min(1000, filters.limit)) : 50;

    return VendorModel.find(query).sort({ createdAt: -1 }).limit(limit);
  },
  findById: (id: string) => VendorModel.findById(id),
  findByIds: (ids: string[]) =>
    VendorModel.find({
      _id: {
        $in: ids,
      },
    }),
  findByReferralCode: (referralCode: string) =>
    VendorModel.findOne({ referralCode: referralCode.trim().toUpperCase() }),
  updateById: (id: string, payload: Record<string, unknown>) =>
    VendorModel.findByIdAndUpdate(id, payload, { returnDocument: "after" }),
  deleteById: (id: string) => VendorModel.findByIdAndDelete(id),
};
