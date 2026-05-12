import { emailOtpService } from "../../email-otp.service";
import { ultramsgWhatsappService } from "../whatsapp/ultramsg-whatsapp.service";

type OtpDeliveryChannel = "email" | "whatsapp";

type SendOtpPayload = {
  channel: OtpDeliveryChannel;
  to: string;
  otpCode: string;
  expiryMinutes: number;
};

function maskEmail(email: string) {
  const [localPart, domain] = email.split("@");
  if (!localPart || !domain) {
    return "redacted";
  }

  if (localPart.length <= 2) {
    return `**@${domain}`;
  }

  return `${localPart.slice(0, 2)}***@${domain}`;
}

function maskMobile(mobile: string) {
  const digitsOnly = mobile.replace(/\D/g, "");
  if (digitsOnly.length <= 4) {
    return "****";
  }

  return `${digitsOnly.slice(0, 2)}****${digitsOnly.slice(-2)}`;
}

function buildWhatsappOtpMessage(otpCode: string, expiryMinutes: number) {
  return [
    "BookMyEvent verification code",
    `OTP: ${otpCode}`,
    `Valid for ${expiryMinutes} minutes.`,
    "Do not share this OTP with anyone.",
  ].join("\n");
}

export const otpNotificationService = {
  sendLoginOtp: async (payload: SendOtpPayload) => {
    if (payload.channel === "email") {
      await emailOtpService.sendOtp({
        toEmail: payload.to,
        otpCode: payload.otpCode,
        expiryMinutes: payload.expiryMinutes,
      });

      return {
        deliveryChannel: "email" as const,
        destinationMasked: maskEmail(payload.to),
      };
    }

    await ultramsgWhatsappService.sendMessage({
      to: payload.to,
      body: buildWhatsappOtpMessage(payload.otpCode, payload.expiryMinutes),
      context: "auth_otp",
    });

    return {
      deliveryChannel: "whatsapp" as const,
      destinationMasked: maskMobile(payload.to),
    };
  },
};
