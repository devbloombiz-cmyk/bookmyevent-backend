import { env } from "../../../config/env";

type VendorLeadWhatsappTemplatePayload = {
  vendorName: string;
  leadId: string;
  eventDate: string;
  eventSlot: string;
  eventTime?: string;
  eventType?: string;
  packageName?: string;
  location: string;
  customerName: string;
  customerMobile: string;
  customerEmail?: string;
  acceptToken?: string;
  rejectToken?: string;
  reviewToken?: string;
};

export function buildVendorLeadWhatsappMessage(payload: VendorLeadWhatsappTemplatePayload) {
  const reviewToken = payload.reviewToken;

  if (reviewToken) {
    const baseUrl = (env.APP_BASE_URL || "https://bookmyevent.com").replace(/\/$/, "");
    const reviewUrl = `${baseUrl}/vendor-lead/review/${reviewToken}`;

    const lines = [
      `Hello ${payload.vendorName},`,
      "",
      "New Lead Enquiry Received",
      "",
      `Lead ID: ${payload.leadId}`,
      "",
      `Event Date: ${payload.eventDate}`,
      "",
      `Slot: ${payload.eventSlot}`,
      "",
      `Selected Package: ${payload.packageName || "Not specified"}`,
      "",
      `Event Type: ${payload.eventType || "Not specified"}`,
      "",
      `Function Date: ${payload.eventDate}`,
      "",
      `Function Time: ${payload.eventTime || payload.eventSlot || "Not specified"}`,
    ];

    lines.push(
      "",
      `Location: ${payload.location}`,
      "",
      `Customer: ${payload.customerName}`,
      "",
      `Mobile: ${payload.customerMobile}`,
    );

    if (payload.customerEmail) {
      lines.push("", "Email:", payload.customerEmail);
    }

    lines.push(
      "",
      "━━━━━━━━━━━━━━━━━━",
      "",
      "Review & Respond:",
      "",
      reviewUrl,
      "",
      "━━━━━━━━━━━━━━━━━━",
      "",
      "This link is secure, valid for 48 hours, and can only be used once.",
    );

    return lines.join("\n");
  }

  // Fallback to legacy format
  const lines = [
    `Hello ${payload.vendorName},`,
    "",
    "New booking enquiry received on BookMyEvent.",
    `Lead ID: ${payload.leadId}`,
    `Event Date: ${payload.eventDate}`,
    `Slot: ${payload.eventSlot}`,
    `Selected Package: ${payload.packageName || "Not specified"}`,
    `Event Type: ${payload.eventType || "Not specified"}`,
    `Function Date: ${payload.eventDate}`,
    `Function Time: ${payload.eventTime || payload.eventSlot || "Not specified"}`,
  ];

  lines.push(
    `Location: ${payload.location}`,
    `Customer: ${payload.customerName}`,
    `Customer Mobile: ${payload.customerMobile}`,
  );

  if (payload.customerEmail) {
    lines.push(`Customer Email: ${payload.customerEmail}`);
  }

  lines.push("", "Please log in to your vendor dashboard to respond.");
  return lines.join("\n");
}
