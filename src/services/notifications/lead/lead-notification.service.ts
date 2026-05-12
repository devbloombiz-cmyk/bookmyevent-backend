import { env } from "../../../config/env";
import { logger } from "../../../config/logger";
import { userRepository } from "../../../repositories/user.repository";
import { vendorRepository } from "../../../repositories/vendor.repository";
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
      const [vendor, customer] = await Promise.all([
        vendorRepository.findById(payload.vendorId),
        userRepository.findById(payload.customerId),
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
      const customerName = customer?.name?.trim() || "Customer";
      const customerMobile = customer?.mobile?.trim() || "Not provided";
      const customerEmail = customer?.email?.trim();

      const message = buildVendorLeadWhatsappMessage({
        vendorName,
        leadId: payload.leadId,
        eventDate: formatEventDate(payload.eventDate),
        eventSlot: payload.eventSlot?.trim() || "Full Day",
        location: payload.location.trim(),
        customerName,
        customerMobile,
        customerEmail,
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
};
