import { env } from "../../../config/env";
import { logger } from "../../../config/logger";
import { userRepository } from "../../../repositories/user.repository";
import { vendorRepository } from "../../../repositories/vendor.repository";
import { leadRepository } from "../../../repositories/lead.repository";
import { buildVendorLeadWhatsappMessage } from "../templates/vendor-lead-whatsapp.template";
import { ultramsgWhatsappService } from "../whatsapp/ultramsg-whatsapp.service";

type LeadVendorNotificationPayload = {
  leadId: string;
  vendorId: string;
  customerId: string;
  eventDate: Date;
  eventSlot?: string;
  location: string;
};

function formatEventDate(value: Date) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "Not specified";
  }

  return date.toISOString().slice(0, 10);
}

function extractFromMessage(message: string | undefined, label: string) {
  if (!message) {
    return "";
  }

  const aliases: Record<string, string[]> = {
    customer: ["Customer Name", "Name", "Customer"],
    mobile: [
      "Mobile Number",
      "Contact",
      "Contact Number",
      "Phone",
      "Phone Number",
      "WhatsApp",
      "Customer mobile",
    ],
    email: ["Email Address", "Mail", "Customer email"],
    time: ["Function time", "Event Time", "Time"],
    type: ["Event type", "Type"],
    package: ["Selected Package", "Package"],
  };

  const normalizedKey = label.trim().toLowerCase();
  const candidates = [label, ...(aliases[normalizedKey] || [])];
  for (const candidate of candidates) {
    const regex = new RegExp(
      `(?:^|\\n)\\s*${candidate.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*:\\s*([^\\n\\r]+)`,
      "i",
    );
    const value = message.match(regex)?.[1]?.trim();
    if (value) {
      return value;
    }
  }

  return "";
}

export const leadNotificationService = {
  sendVendorLeadCreatedWhatsapp: async (payload: LeadVendorNotificationPayload) => {
    if (!env.WHATSAPP_VENDOR_LEAD_NOTIFICATION_ENABLED) {
      return;
    }

    if (!ultramsgWhatsappService.isEnabled()) {
      logger.info(
        {
          event: "lead.whatsapp.skipped",
          reason: "provider_not_configured",
          leadId: payload.leadId,
          vendorId: payload.vendorId,
        },
        "Lead vendor WhatsApp notification skipped",
      );
      return;
    }

    try {
      const [vendor, customer, lead] = await Promise.all([
        vendorRepository.findById(payload.vendorId),
        payload.customerId ? userRepository.findById(payload.customerId) : Promise.resolve(null),
        leadRepository.findById(payload.leadId),
      ]);

      const vendorMobile = vendor?.mobile?.trim();
      if (!vendorMobile) {
        logger.info(
          {
            event: "lead.whatsapp.skipped",
            reason: "vendor_mobile_missing",
            leadId: payload.leadId,
            vendorId: payload.vendorId,
          },
          "Lead vendor WhatsApp notification skipped",
        );
        return;
      }

      const vendorName = vendor?.businessName?.trim() || vendor?.ownerName?.trim() || "Vendor";
      const customerName = lead?.customerName?.trim() || customer?.name?.trim() || "Customer";
      const customerMobile =
        lead?.customerMobile?.trim() || customer?.mobile?.trim() || "Not provided";
      const customerEmail = lead?.customerEmail?.trim() || customer?.email?.trim();

      // format Lead ID display to be like: LEAD-2026-000124 (last 6 hex uppercase)
      const year = lead?.createdAt
        ? new Date(lead.createdAt).getFullYear()
        : new Date().getFullYear();
      const shortId = payload.leadId.slice(-6).toUpperCase();
      const leadIdDisplay = `LEAD-${year}-${shortId}`;

      const eventTime = extractFromMessage(lead?.message || "", "time");
      const eventType = extractFromMessage(lead?.message || "", "type");
      const packageName =
        lead?.venuePackageName || extractFromMessage(lead?.message || "", "package");

      const message = buildVendorLeadWhatsappMessage({
        vendorName,
        leadId: leadIdDisplay,
        eventDate: formatEventDate(payload.eventDate),
        eventSlot: payload.eventSlot?.trim() || "Full Day",
        eventTime: eventTime || undefined,
        eventType: eventType || undefined,
        packageName: packageName || undefined,
        location: payload.location.trim(),
        customerName,
        customerMobile,
        customerEmail,
        acceptToken: lead?.acceptToken ?? undefined,
        rejectToken: lead?.rejectToken ?? undefined,
        reviewToken: lead?.reviewToken ?? undefined,
      });

      await ultramsgWhatsappService.sendMessage({
        to: vendorMobile,
        body: message,
        context: "vendor_lead_notification",
      });

      logger.info(
        {
          event: "lead.whatsapp.succeeded",
          leadId: payload.leadId,
          vendorId: payload.vendorId,
        },
        "Lead vendor WhatsApp notification delivered",
      );
    } catch (error) {
      logger.error(
        {
          event: "lead.whatsapp.failed",
          leadId: payload.leadId,
          vendorId: payload.vendorId,
          customerId: payload.customerId,
          error,
        },
        "Lead vendor WhatsApp notification failed",
      );
    }
  },

  sendCustomerLeadAcceptedWhatsapp: async (leadId: string) => {
    if (!env.WHATSAPP_VENDOR_LEAD_NOTIFICATION_ENABLED) {
      return;
    }

    if (!ultramsgWhatsappService.isEnabled()) {
      return;
    }

    try {
      const lead = await leadRepository.findById(leadId);
      if (!lead) return;

      const vendor = await vendorRepository.findById(String(lead.vendorId));
      const vendorName = vendor?.businessName?.trim() || vendor?.ownerName?.trim() || "Vendor";
      const customerMobile = lead.customerMobile?.trim();

      if (!customerMobile) {
        logger.warn(
          { event: "customer.lead_accepted.whatsapp.skipped", reason: "missing_mobile", leadId },
          "Customer WhatsApp alert skipped: missing mobile number",
        );
        return;
      }

      const customerName = lead.customerName?.trim() || "Customer";

      const message = [
        `Hello ${customerName},`,
        "",
        `${vendorName} has accepted your enquiry.`,
        "",
        "Our team will contact you shortly.",
        "",
        "Thank you for choosing BookMyEvent.",
      ].join("\n");

      await ultramsgWhatsappService.sendMessage({
        to: customerMobile,
        body: message,
        context: "customer_lead_accepted",
      });

      logger.info(
        {
          event: "customer.lead_accepted.whatsapp.succeeded",
          leadId,
        },
        "Customer lead accepted WhatsApp notification delivered",
      );
    } catch (error) {
      logger.error(
        {
          event: "customer.lead_accepted.whatsapp.failed",
          leadId,
          error,
        },
        "Customer lead accepted WhatsApp notification failed",
      );
    }
  },

  sendCustomerLeadRejectedWhatsapp: async (leadId: string) => {
    if (!env.WHATSAPP_VENDOR_LEAD_NOTIFICATION_ENABLED) {
      return;
    }

    if (!ultramsgWhatsappService.isEnabled()) {
      return;
    }

    try {
      const lead = await leadRepository.findById(leadId);
      if (!lead) return;

      const vendor = await vendorRepository.findById(String(lead.vendorId));
      const vendorName = vendor?.businessName?.trim() || vendor?.ownerName?.trim() || "Vendor";
      const customerMobile = lead.customerMobile?.trim();

      if (!customerMobile) {
        logger.warn(
          { event: "customer.lead_rejected.whatsapp.skipped", reason: "missing_mobile", leadId },
          "Customer WhatsApp alert skipped: missing mobile number",
        );
        return;
      }

      const customerName = lead.customerName?.trim() || "Customer";

      const message = [
        `Hello ${customerName},`,
        "",
        "Thank you for your enquiry.",
        "",
        `Unfortunately ${vendorName} is unable to accept your request.`,
        "",
        "Please browse other available vendors on BookMyEvent.",
      ].join("\n");

      await ultramsgWhatsappService.sendMessage({
        to: customerMobile,
        body: message,
        context: "customer_lead_rejected",
      });

      logger.info(
        {
          event: "customer.lead_rejected.whatsapp.succeeded",
          leadId,
        },
        "Customer lead rejected WhatsApp notification delivered",
      );
    } catch (error) {
      logger.error(
        {
          event: "customer.lead_rejected.whatsapp.failed",
          leadId,
          error,
        },
        "Customer lead rejected WhatsApp notification failed",
      );
    }
  },
};
