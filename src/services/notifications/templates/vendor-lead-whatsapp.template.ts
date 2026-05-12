type VendorLeadWhatsappTemplatePayload = {
  vendorName: string;
  leadId: string;
  eventDate: string;
  eventSlot: string;
  location: string;
  customerName: string;
  customerMobile: string;
  customerEmail?: string;
};

export function buildVendorLeadWhatsappMessage(payload: VendorLeadWhatsappTemplatePayload) {
  const lines = [
    `Hello ${payload.vendorName},`,
    "",
    "New booking enquiry received on BookMyEvent.",
    `Lead ID: ${payload.leadId}`,
    `Event Date: ${payload.eventDate}`,
    `Slot: ${payload.eventSlot}`,
    `Location: ${payload.location}`,
    `Customer: ${payload.customerName}`,
    `Customer Mobile: ${payload.customerMobile}`,
  ];

  if (payload.customerEmail) {
    lines.push(`Customer Email: ${payload.customerEmail}`);
  }

  lines.push("", "Please log in to your vendor dashboard to respond.");
  return lines.join("\n");
}
