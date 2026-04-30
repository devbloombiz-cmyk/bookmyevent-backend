import { LeadModel } from "../models/lead.model";

export const leadRepository = {
  create: (payload: Record<string, unknown>) => LeadModel.create(payload),
  findAll: () => LeadModel.find().sort({ createdAt: -1 }),
  findByVendor: (vendorId: string) => LeadModel.find({ vendorId }).sort({ createdAt: -1 }),
  findById: (leadId: string) => LeadModel.findById(leadId),
  updateById: (leadId: string, payload: Record<string, unknown>) =>
    LeadModel.findByIdAndUpdate(leadId, payload, { returnDocument: "after" }),
};
