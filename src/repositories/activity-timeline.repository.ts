import { ActivityTimelineModel } from "../models/activity-timeline.model";

export const activityTimelineRepository = {
  create: (payload: Record<string, unknown>) => ActivityTimelineModel.create(payload),
  listByEntity: (entityType: "lead" | "booking" | "payment_request", entityId: string) =>
    ActivityTimelineModel.find({ entityType, entityId }).sort({ createdAt: -1 }),
};
