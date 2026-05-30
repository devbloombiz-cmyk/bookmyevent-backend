import { availabilityService } from "../services/availability.service";
import { sendSuccess } from "../utils/api-response";
import { asyncHandler } from "../utils/async-handler";

export const availabilityController = {
  setAvailability: asyncHandler(async (req, res) => {
    const authUser = req.authUser;
    if (!authUser) {
      return sendSuccess(res, "Unauthorized", { availability: null }, 401);
    }

    const availability = await availabilityService.setAvailability(req.body, authUser);
    return sendSuccess(res, "Availability upserted", { availability });
  }),
  listByVendor: asyncHandler(async (req, res) => {
    const vendorId = typeof req.query.vendorId === "string" ? req.query.vendorId : undefined;
    const slots = await availabilityService.listByVendor(vendorId, req.authUser);
    return sendSuccess(res, "Availability fetched", { slots });
  }),
  listByVendorPublic: asyncHandler(async (req, res) => {
    const vendorId = typeof req.query.vendorId === "string" ? req.query.vendorId : undefined;
    const slots = await availabilityService.listByVendor(vendorId);
    return sendSuccess(res, "Availability fetched", { slots });
  }),
  checkBookingAvailability: asyncHandler(async (req, res) => {
    const result = await availabilityService.checkBookingAvailability({
      vendorId: String(req.query.vendorId || ""),
      packageId: String(req.query.packageId || ""),
      eventDate: new Date(String(req.query.eventDate || "")),
      venueOwnerId: typeof req.query.venueOwnerId === "string" ? req.query.venueOwnerId : null,
      customerId: typeof req.query.customerId === "string" ? req.query.customerId : null,
      customerMobile:
        typeof req.query.customerMobile === "string" ? req.query.customerMobile : null,
    });

    return sendSuccess(res, "Booking availability checked", { availability: result });
  }),
  listAvailableVendorsByDate: asyncHandler(async (req, res) => {
    const eventDate = req.query.date;
    const date = typeof eventDate === "string" ? new Date(eventDate) : null;

    if (!date || Number.isNaN(date.getTime())) {
      return sendSuccess(res, "Invalid date", { vendorIds: [] }, 400);
    }

    const vendorIds = await availabilityService.listAvailableVendorIdsByDate(date);
    return sendSuccess(res, "Available vendors fetched", { vendorIds });
  }),
};
