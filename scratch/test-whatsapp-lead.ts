/* eslint-disable no-console */
import { buildVendorLeadWhatsappMessage } from "../src/services/notifications/templates/vendor-lead-whatsapp.template";

const payloadWithReviewToken = {
  vendorName: "Le Meridien",
  leadId: "LEAD-2026-ABC123",
  eventDate: "2026-07-15",
  eventSlot: "Full Day",
  packageName: "Royal Banquet Hall Package",
  packageStartTime: "09:00",
  packageEndTime: "23:00",
  eventType: "Wedding",
  eventTime: "10:00 AM",
  location: "Kochi, Kerala",
  customerName: "John Doe",
  customerMobile: "9876543210",
  customerEmail: "john@example.com",
  reviewToken: "dummy_review_token",
};

const messageWithToken = buildVendorLeadWhatsappMessage(payloadWithReviewToken);
console.log("--- MESSAGE WITH REVIEW TOKEN ---");
console.log(messageWithToken);
console.log("---------------------------------\n");

const payloadLegacy = {
  ...payloadWithReviewToken,
  reviewToken: undefined,
};

const messageLegacy = buildVendorLeadWhatsappMessage(payloadLegacy);
console.log("--- LEGACY MESSAGE ---");
console.log(messageLegacy);
console.log("----------------------");
