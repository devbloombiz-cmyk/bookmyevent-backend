import mongoose from "mongoose";
import { leadRepository } from "../repositories/lead.repository";
import { leadActionAuditLogRepository } from "../repositories/lead-action-audit-log.repository";
import { leadNotificationService } from "./notifications/lead/lead-notification.service";
import { packageRepository } from "../repositories/package.repository";
import { trySendBookingConfirmedWhatsapp } from "./payment-request.service";
import { ApiError } from "../utils/api-error";
import { bookingRepository } from "../repositories/booking.repository";
import { availabilityRepository } from "../repositories/availability.repository";
import { logger } from "../config/logger";
import { vendorRepository } from "../repositories/vendor.repository";
import { VenueOwnerModel } from "../models/venue-owner.model";
import { PlatformPackageModel } from "../models/platform-package.model";
import { VendorPackageModel } from "../models/vendor-package.model";
import { LeadModel } from "../models/lead.model";

type LeadDocument = InstanceType<typeof LeadModel>;

function normalizeMobile(rawValue: string) {
  const trimmed = String(rawValue || "").trim();
  const digits = trimmed.replace(/\D/g, "");
  return digits.length >= 10 ? digits : "";
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function extractFromMessage(message: string | undefined, label: string) {
  if (!message) {
    return "";
  }

  const aliases: Record<string, string[]> = {
    customer: ["Customer Name", "Name"],
    mobile: ["Mobile Number", "Contact", "Contact Number", "Phone", "Phone Number", "WhatsApp"],
    email: ["Email Address", "Mail"],
  };

  const normalizedKey = label.trim().toLowerCase();
  const candidates = [label, ...(aliases[normalizedKey] || [])];
  for (const candidate of candidates) {
    const regex = new RegExp(`(?:^|\\n)\\s*${escapeRegExp(candidate)}\\s*:\\s*([^\\n\\r]+)`, "i");
    const value = message.match(regex)?.[1]?.trim();
    if (value) {
      return value;
    }
  }

  return "";
}

async function resolvePackagePriceAndName(
  lead: LeadDocument,
  vendorId: string | null,
): Promise<{ packageId: string | null; amount: number; packageName: string }> {
  let packageId =
    lead.packageId && mongoose.Types.ObjectId.isValid(lead.packageId)
      ? String(lead.packageId)
      : null;
  let amount = 0;
  let packageName = lead.venuePackageName || "Selected Package";

  if (packageId) {
    // 1. Try VendorPackageModel by ID
    let pkg: {
      price?: number | null;
      basePrice?: number | null;
      title?: string | null;
      packageName?: string | null;
    } | null = await VendorPackageModel.findById(packageId);

    // 2. Try VenueOwner subdocument by ID
    if (!pkg && lead.venueOwnerId) {
      const venueOwner = await VenueOwnerModel.findById(lead.venueOwnerId);
      const subPkg = venueOwner?.venuePackages?.find((p) => String(p._id) === packageId);
      if (subPkg) {
        pkg = subPkg;
      }
    }

    // 3. Try VenueOwner subdocument by ID across all venue owners (just in case)
    if (!pkg) {
      const venueOwner = await VenueOwnerModel.findOne({ "venuePackages._id": packageId });
      const subPkg = venueOwner?.venuePackages?.find((p) => String(p._id) === packageId);
      if (subPkg) {
        pkg = subPkg;
      }
    }

    // 4. Try PlatformPackageModel by ID
    if (!pkg) {
      const platformPkg = await PlatformPackageModel.findById(packageId);
      if (platformPkg) {
        pkg = platformPkg;
      }
    }

    // 5. Try searching by venuePackageName/title under vendor or venueOwner as fallback
    if (!pkg && lead.venuePackageName) {
      const cleanName = String(lead.venuePackageName).trim();
      if (cleanName) {
        const nameRegex = new RegExp("^" + escapeRegExp(cleanName) + "$", "i");

        // Try in VendorPackageModel under this vendor
        if (vendorId) {
          const vendorPkg = await VendorPackageModel.findOne({
            vendorId,
            title: nameRegex,
            isActive: true,
          });
          if (vendorPkg) {
            pkg = vendorPkg;
          }
        }

        // Try in VenueOwner venuePackages
        if (!pkg && lead.venueOwnerId) {
          const venueOwner = await VenueOwnerModel.findById(lead.venueOwnerId);
          const subPkg = venueOwner?.venuePackages?.find(
            (p) =>
              p.isActive !== false &&
              new RegExp("^" + escapeRegExp(String(p.packageName || "").trim()) + "$", "i").test(
                cleanName,
              ),
          );
          if (subPkg) {
            pkg = subPkg;
          }
        }
      }
    }

    if (pkg) {
      amount = Number(pkg.price || pkg.basePrice || 0);
      packageName = String(pkg.title || pkg.packageName || packageName);
    }
  } else if (vendorId) {
    // If no packageId on lead, try to find vendor's first active package
    const vendorPackages = await packageRepository.listVendorPackages(vendorId, false);
    if (vendorPackages.length > 0) {
      packageId = String(vendorPackages[0]._id);
      amount = Number(vendorPackages[0].price) || 0;
      packageName = vendorPackages[0].title || packageName;
    }
  }

  if (amount === 0 && lead.quoteAmount) {
    amount = Number(lead.quoteAmount) || 0;
  }

  return { packageId, amount, packageName };
}

async function processLeadAcceptance(
  lead: LeadDocument,
  ipAddress: string,
  userAgent: string,
  logReason: string,
) {
  const leadIdStr = String(lead._id);
  const vendorId = lead.vendorId ? String(lead.vendorId) : null;
  const venueOwnerId = lead.venueOwnerId ? String(lead.venueOwnerId) : null;

  // Check for existing booking to prevent duplicates
  const existingBooking = await bookingRepository.findByLeadId(leadIdStr);
  if (existingBooking) {
    throw new ApiError(400, "ALREADY_ACCEPTED");
  }

  // Create booking from lead data
  const customerName =
    String(lead.customerName || "").trim() ||
    extractFromMessage(String(lead.message || ""), "customer");
  const customerMobile =
    normalizeMobile(String(lead.customerMobile || "")) ||
    normalizeMobile(extractFromMessage(String(lead.message || ""), "mobile"));
  const customerEmail =
    String(lead.customerEmail || "").trim() ||
    extractFromMessage(String(lead.message || ""), "email");

  // Resolve package details using the helper function
  const resolvedPkg = await resolvePackagePriceAndName(lead, vendorId);
  const packageId = resolvedPkg.packageId;
  const amount = resolvedPkg.amount;
  const packageName = resolvedPkg.packageName;

  const booking = await bookingRepository.create({
    customerId: lead.customerId ?? null,
    customerName,
    customerMobile,
    customerEmail,
    vendorId: lead.vendorId,
    leadId: lead._id,
    packageId,
    eventDate: lead.eventDate,
    eventSlot: lead.eventSlot,
    amount,
    advancePaid: 0,
    paymentStatus: "pending",
    paidAmount: 0,
    dueAmount: amount,
    bookingStatus: "upcoming",
    vendorAmount: amount,
    settledAmount: 0,
    pendingSettlement: amount,
    settlementStatus: "PENDING",
    referralCode: String(lead.referralCode || ""),
    referralVendorId: lead.referralVendorId ?? null,
  });

  // Mark availability slot as booked
  if (lead.eventDate && lead.eventSlot && vendorId) {
    await availabilityRepository.upsertSlot({
      vendorId,
      date: new Date(lead.eventDate),
      slot: String(lead.eventSlot),
      status: "booked",
    });
  }

  lead.status = "BOOKED";
  lead.acceptTokenUsed = true;
  lead.rejectTokenUsed = true;
  lead.reviewTokenUsed = true;
  lead.acceptedAt = new Date();
  lead.actionIPAddress = ipAddress;
  lead.actionUserAgent = userAgent;
  lead.actionPerformedAt = new Date();

  await lead.save();

  await leadActionAuditLogRepository.create({
    vendorId,
    leadId: leadIdStr,
    venueOwnerId,
    action: "ACCEPT",
    ipAddress,
    userAgent,
    status: "SUCCESS",
    reason: logReason,
  });

  // Send booking confirmation WhatsApp to customer
  if (customerMobile) {
    setImmediate(async () => {
      try {
        const vendorObj = await vendorRepository.findById(String(lead.vendorId));
        const vendorName = vendorObj?.businessName?.trim() || vendorObj?.ownerName?.trim() || "";

        await trySendBookingConfirmedWhatsapp({
          mobile: customerMobile,
          bookingId: String(booking._id),
          customerName,
          packageName,
          vendorName,
          eventDate: lead.eventDate ? new Date(lead.eventDate) : undefined,
        });
      } catch (err) {
        logger.warn(
          { error: err, bookingId: booking._id },
          "Failed to send booking confirmation whatsapp via magic link",
        );
      }
    });
  }

  return lead;
}

async function processLeadRejection(
  lead: LeadDocument,
  ipAddress: string,
  userAgent: string,
  logReason: string,
) {
  const leadIdStr = String(lead._id);
  const vendorId = lead.vendorId ? String(lead.vendorId) : null;
  const venueOwnerId = lead.venueOwnerId ? String(lead.venueOwnerId) : null;

  lead.status = "CANCELLED";
  lead.acceptTokenUsed = true;
  lead.rejectTokenUsed = true;
  lead.reviewTokenUsed = true;
  lead.rejectedAt = new Date();
  lead.actionIPAddress = ipAddress;
  lead.actionUserAgent = userAgent;
  lead.actionPerformedAt = new Date();

  await lead.save();

  await leadActionAuditLogRepository.create({
    vendorId,
    leadId: leadIdStr,
    venueOwnerId,
    action: "REJECT",
    ipAddress,
    userAgent,
    status: "SUCCESS",
    reason: logReason,
  });

  setImmediate(() => {
    void leadNotificationService.sendCustomerLeadRejectedWhatsapp(leadIdStr);
  });

  return lead;
}

export const vendorLeadActionService = {
  acceptLead: async (token: string, ipAddress: string, userAgent: string) => {
    const lead = await leadRepository.findByAcceptToken(token);

    if (!lead) {
      // Check if this token was actually the reject token of another lead
      const otherLead = await leadRepository.findByRejectToken(token);
      if (otherLead) {
        throw new ApiError(400, "ALREADY_REJECTED");
      }

      await leadActionAuditLogRepository.create({
        vendorId: null,
        leadId: null,
        venueOwnerId: null,
        action: "ACCEPT",
        ipAddress,
        userAgent,
        status: "FAILURE",
        reason: "Invalid token",
      });
      throw new ApiError(404, "INVALID_TOKEN");
    }

    if (lead.status === "Accepted" || lead.status === "CONTACTED" || lead.status === "BOOKED") {
      throw new ApiError(400, "ALREADY_ACCEPTED");
    }
    if (lead.status === "Rejected") {
      throw new ApiError(400, "ALREADY_REJECTED");
    }

    if (lead.tokenExpiry && new Date() > new Date(lead.tokenExpiry)) {
      await leadActionAuditLogRepository.create({
        vendorId: lead.vendorId ? String(lead.vendorId) : null,
        leadId: String(lead._id),
        venueOwnerId: lead.venueOwnerId ? String(lead.venueOwnerId) : null,
        action: "ACCEPT",
        ipAddress,
        userAgent,
        status: "FAILURE",
        reason: "Link expired",
      });
      throw new ApiError(400, "TOKEN_EXPIRED");
    }

    return processLeadAcceptance(
      lead,
      ipAddress,
      userAgent,
      "Lead booked successfully via magic link",
    );
  },

  rejectLead: async (token: string, ipAddress: string, userAgent: string) => {
    const lead = await leadRepository.findByRejectToken(token);

    if (!lead) {
      const otherLead = await leadRepository.findByAcceptToken(token);
      if (otherLead) {
        throw new ApiError(400, "ALREADY_ACCEPTED");
      }

      await leadActionAuditLogRepository.create({
        vendorId: null,
        leadId: null,
        venueOwnerId: null,
        action: "REJECT",
        ipAddress,
        userAgent,
        status: "FAILURE",
        reason: "Invalid token",
      });
      throw new ApiError(404, "INVALID_TOKEN");
    }

    if (lead.status === "Accepted" || lead.status === "CONTACTED") {
      throw new ApiError(400, "ALREADY_ACCEPTED");
    }
    if (lead.status === "Rejected" || lead.status === "CANCELLED") {
      throw new ApiError(400, "ALREADY_REJECTED");
    }

    if (lead.tokenExpiry && new Date() > new Date(lead.tokenExpiry)) {
      await leadActionAuditLogRepository.create({
        vendorId: lead.vendorId ? String(lead.vendorId) : null,
        leadId: String(lead._id),
        venueOwnerId: lead.venueOwnerId ? String(lead.venueOwnerId) : null,
        action: "REJECT",
        ipAddress,
        userAgent,
        status: "FAILURE",
        reason: "Link expired",
      });
      throw new ApiError(400, "TOKEN_EXPIRED");
    }

    return processLeadRejection(
      lead,
      ipAddress,
      userAgent,
      "Lead rejected successfully via magic link",
    );
  },

  getLeadAndPackagesForReview: async (token: string) => {
    const lead = await leadRepository.findByReviewToken(token);

    if (!lead) {
      throw new ApiError(404, "INVALID_TOKEN");
    }

    if (lead.reviewTokenUsed || lead.status !== "Pending") {
      if (lead.status === "Rejected" || lead.status === "CANCELLED") {
        throw new ApiError(400, "ALREADY_REJECTED");
      }
      if (lead.status === "Accepted" || lead.status === "CONTACTED" || lead.status === "BOOKED") {
        throw new ApiError(400, "ALREADY_ACCEPTED");
      }
      throw new ApiError(400, "ALREADY_PROCESSED");
    }

    if (lead.tokenExpiry && new Date() > new Date(lead.tokenExpiry)) {
      throw new ApiError(400, "TOKEN_EXPIRED");
    }

    const packages = await packageRepository.listVendorPackages(String(lead.vendorId), false);

    return { lead, packages };
  },

  acceptLeadWithReviewToken: async (token: string, ipAddress: string, userAgent: string) => {
    const lead = await leadRepository.findByReviewToken(token);

    if (!lead) {
      await leadActionAuditLogRepository.create({
        vendorId: null,
        leadId: null,
        venueOwnerId: null,
        action: "ACCEPT",
        ipAddress,
        userAgent,
        status: "FAILURE",
        reason: "Invalid review token",
      });
      throw new ApiError(404, "INVALID_TOKEN");
    }

    if (lead.reviewTokenUsed || lead.status !== "Pending") {
      if (lead.status === "Rejected" || lead.status === "CANCELLED") {
        throw new ApiError(400, "ALREADY_REJECTED");
      }
      throw new ApiError(400, "ALREADY_ACCEPTED");
    }

    if (lead.tokenExpiry && new Date() > new Date(lead.tokenExpiry)) {
      await leadActionAuditLogRepository.create({
        vendorId: lead.vendorId ? String(lead.vendorId) : null,
        leadId: String(lead._id),
        venueOwnerId: lead.venueOwnerId ? String(lead.venueOwnerId) : null,
        action: "ACCEPT",
        ipAddress,
        userAgent,
        status: "FAILURE",
        reason: "Link expired",
      });
      throw new ApiError(400, "TOKEN_EXPIRED");
    }

    return processLeadAcceptance(
      lead,
      ipAddress,
      userAgent,
      "Lead booked successfully via single review magic link",
    );
  },

  rejectLeadWithReviewToken: async (token: string, ipAddress: string, userAgent: string) => {
    const lead = await leadRepository.findByReviewToken(token);

    if (!lead) {
      await leadActionAuditLogRepository.create({
        vendorId: null,
        leadId: null,
        venueOwnerId: null,
        action: "REJECT",
        ipAddress,
        userAgent,
        status: "FAILURE",
        reason: "Invalid review token",
      });
      throw new ApiError(404, "INVALID_TOKEN");
    }

    if (lead.reviewTokenUsed || lead.status !== "Pending") {
      if (lead.status === "Accepted" || lead.status === "CONTACTED" || lead.status === "BOOKED") {
        throw new ApiError(400, "ALREADY_ACCEPTED");
      }
      throw new ApiError(400, "ALREADY_REJECTED");
    }

    if (lead.tokenExpiry && new Date() > new Date(lead.tokenExpiry)) {
      await leadActionAuditLogRepository.create({
        vendorId: lead.vendorId ? String(lead.vendorId) : null,
        leadId: String(lead._id),
        venueOwnerId: lead.venueOwnerId ? String(lead.venueOwnerId) : null,
        action: "REJECT",
        ipAddress,
        userAgent,
        status: "FAILURE",
        reason: "Link expired",
      });
      throw new ApiError(400, "TOKEN_EXPIRED");
    }

    return processLeadRejection(
      lead,
      ipAddress,
      userAgent,
      "Lead rejected successfully via single review magic link",
    );
  },
};
