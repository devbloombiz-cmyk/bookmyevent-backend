import { activityTimelineRepository } from "../repositories/activity-timeline.repository";

export const activityTimelineService = {
  addEvent: async (payload: {
    entityType: "lead" | "booking" | "payment_request";
    entityId: string;
    vendorId?: string;
    actorUserId?: string;
    event: string;
    message?: string;
    metadata?: Record<string, unknown>;
  }) => {
    await activityTimelineRepository.create({
      entityType: payload.entityType,
      entityId: payload.entityId,
      vendorId: payload.vendorId ?? null,
      actorUserId: payload.actorUserId ?? null,
      event: payload.event,
      message: payload.message ?? "",
      metadata: payload.metadata ?? {},
    });
  },
};
