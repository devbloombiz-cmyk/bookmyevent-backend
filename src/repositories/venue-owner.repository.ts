import { VenueOwnerModel } from "../models/venue-owner.model";

const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

export const venueOwnerRepository = {
  create: (payload: Record<string, unknown>) => VenueOwnerModel.create(payload),
  findById: (id: string) => VenueOwnerModel.findById(id),
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

    return VenueOwnerModel.findOne({ $or: conditions });
  },
  findAll: (filters: Record<string, unknown> = {}) => {
    const query: Record<string, unknown> = {};
    const includeInactive = filters.includeInactive === true;

    if (!includeInactive) {
      query.approvalStatus = "active";
      query.isActive = true;
    }

    if (typeof filters.approvalStatus === "string" && filters.approvalStatus.trim()) {
      query.approvalStatus = filters.approvalStatus.trim();
    }

    if (typeof filters.venueType === "string" && filters.venueType.trim()) {
      query.venueType = new RegExp(`^${escapeRegExp(filters.venueType.trim())}$`, "i");
    }

    if (typeof filters.district === "string" && filters.district.trim()) {
      query.district = new RegExp(`^${escapeRegExp(filters.district.trim())}$`, "i");
    }

    if (typeof filters.city === "string" && filters.city.trim()) {
      query.city = new RegExp(`^${escapeRegExp(filters.city.trim())}$`, "i");
    }

    if (typeof filters.search === "string" && filters.search.trim()) {
      const searchRegex = new RegExp(escapeRegExp(filters.search.trim()), "i");
      query.$or = [
        { businessName: searchRegex },
        { ownerName: searchRegex },
        { venueType: searchRegex },
        { city: searchRegex },
      ];
    }

    const limit = typeof filters.limit === "number" ? Math.max(1, Math.min(200, filters.limit)) : 60;

    return VenueOwnerModel.find(query).sort({ createdAt: -1 }).limit(limit);
  },
  updateById: (id: string, payload: Record<string, unknown>) =>
    VenueOwnerModel.findByIdAndUpdate(id, payload, { returnDocument: "after" }),
  deleteById: (id: string) => VenueOwnerModel.findByIdAndDelete(id),
};
