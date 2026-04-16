import { leadRepository } from "../repositories/lead.repository";

export const leadService = {
  createLead: (payload: Record<string, unknown>) => leadRepository.create(payload),
  listLeads: () => leadRepository.findAll(),
};
