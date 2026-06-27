import { LeadActionAuditLogModel } from "../models/lead-action-audit-log.model";

export const leadActionAuditLogRepository = {
  create: (payload: Record<string, unknown>) => LeadActionAuditLogModel.create(payload),
};
