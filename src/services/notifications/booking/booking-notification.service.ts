import { logger } from "../../../config/logger";
import { packageRepository } from "../../../repositories/package.repository";
import { userRepository } from "../../../repositories/user.repository";
import { vendorRepository } from "../../../repositories/vendor.repository";
import { buildBookingConfirmationWhatsappMessage } from "../templates/booking-whatsapp.template";
import { ultramsgWhatsappService } from "../whatsapp/ultramsg-whatsapp.service";

type BookingNotificationPayload = {
  bookingId: string;
  customerId: string;
  vendorId: string;
  packageId: string;
};

async function resolvePackageTitle(packageId: string) {
  const [vendorPackage, platformPackage] = await Promise.all([
    packageRepository.findVendorPackageById(packageId),
    packageRepository.findPlatformPackageById(packageId),
  ]);

  return (
    (typeof vendorPackage?.title === "string" && vendorPackage.title.trim()) ||
    (typeof platformPackage?.title === "string" && platformPackage.title.trim()) ||
    "Selected Package"
  );
}

export const bookingNotificationService = {
  sendCustomerBookingConfirmation: async (payload: BookingNotificationPayload) => {
    if (!ultramsgWhatsappService.isEnabled()) {
      logger.info(
        {
          event: "booking.whatsapp.skipped",
          reason: "provider_not_configured",
          bookingId: payload.bookingId,
        },
        "Booking WhatsApp notification skipped",
      );
      return;
    }

    try {
      const [customer, vendor, packageTitle] = await Promise.all([
        userRepository.findById(payload.customerId),
        vendorRepository.findById(payload.vendorId),
        resolvePackageTitle(payload.packageId),
      ]);

      const mobile = customer?.mobile?.trim();
      if (!mobile) {
        logger.info(
          {
            event: "booking.whatsapp.skipped",
            reason: "customer_mobile_missing",
            bookingId: payload.bookingId,
            customerId: payload.customerId,
          },
          "Booking WhatsApp notification skipped",
        );
        return;
      }

      const customerName = customer?.name?.trim() || "Customer";
      const vendorName =
        (typeof vendor?.businessName === "string" && vendor.businessName.trim()) ||
        (typeof vendor?.ownerName === "string" && vendor.ownerName.trim()) ||
        "BookMyEvent Vendor";

      const message = buildBookingConfirmationWhatsappMessage({
        customerName,
        bookingId: payload.bookingId,
        packageName: packageTitle,
        vendorName,
      });

      await ultramsgWhatsappService.sendMessage({
        to: mobile,
        body: message,
        context: "booking_confirmation",
      });
    } catch (error) {
      logger.error(
        {
          event: "booking.whatsapp.failed",
          bookingId: payload.bookingId,
          customerId: payload.customerId,
          vendorId: payload.vendorId,
          packageId: payload.packageId,
          error,
        },
        "Failed to send booking WhatsApp notification",
      );
    }
  },
};
