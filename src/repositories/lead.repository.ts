import { LeadModel } from "../models/lead.model";

export const leadRepository = {
  create: (payload: Record<string, unknown>) => LeadModel.create(payload),
  findAll: () => LeadModel.find().sort({ createdAt: -1 }),
};
