type BookingWhatsappTemplatePayload = {
  customerName: string;
  bookingId: string;
  packageName: string;
  vendorName: string;
};

export function buildBookingConfirmationWhatsappMessage(payload: BookingWhatsappTemplatePayload) {
  return [
    `Hi ${payload.customerName},`,
    "",
    "Your booking is confirmed with BookMyEvent.",
    `Booking ID: ${payload.bookingId}`,
    `Vendor: ${payload.vendorName}`,
    `Package: ${payload.packageName}`,
    "",
    "Thank you for choosing BookMyEvent.",
  ].join("\n");
}
