import { logger } from "../config/logger";

type AuditLogPayload = {
  actorUserId?: string;
  action: string;
  resource?: string;
  outcome: "allowed" | "denied" | "success" | "failure";
  metadata?: Record<string, unknown>;
};

export const auditLogService = {
  write: (payload: AuditLogPayload) => {
    logger.info({ audit: payload }, "audit_event");
  },
};
