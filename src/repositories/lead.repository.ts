import { LeadModel } from "../models/lead.model";

export const leadRepository = {
  create: (payload: Record<string, unknown>) => LeadModel.create(payload),
  findAll: (filters?: { status?: string; vendorId?: string; venueOwnerId?: string }) => {
    const query: Record<string, unknown> = {};

    if (filters?.status) {
      query.status = filters.status;
    }

    if (filters?.vendorId) {
      query.vendorId = filters.vendorId;
    }

    if (filters?.venueOwnerId) {
      query.venueOwnerId = filters.venueOwnerId;
    }

    return LeadModel.find(query).sort({ createdAt: -1 });
  },
  findByVendor: (vendorId: string, status?: string) => {
    const query: Record<string, unknown> = {
      vendorId,
      $or: [{ venueOwnerId: { $exists: false } }, { venueOwnerId: null }],
    };
    if (status) {
      query.status = status;
    }
    return LeadModel.find(query).sort({ createdAt: -1 });
  },
  findByVenueOwner: (venueOwnerId: string, status?: string) => {
    const query: Record<string, unknown> = { venueOwnerId };
    if (status) {
      query.status = status;
    }
    return LeadModel.find(query).sort({ createdAt: -1 });
  },
  findByIds: (leadIds: string[]) =>
    LeadModel.find({
      _id: {
        $in: leadIds,
      },
    }),
  findById: (leadId: string) => LeadModel.findById(leadId),
  findByAcceptToken: (token: string) => LeadModel.findOne({ acceptToken: token }),
  findByRejectToken: (token: string) => LeadModel.findOne({ rejectToken: token }),
  findByReviewToken: (token: string) => LeadModel.findOne({ reviewToken: token }),
  updateById: (leadId: string, payload: Record<string, unknown>) =>
    LeadModel.findByIdAndUpdate(leadId, payload, { returnDocument: "after" }),
};
