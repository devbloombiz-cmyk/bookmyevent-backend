import SibApiV3Sdk from "sib-api-v3-sdk";
import nodemailer from "nodemailer";
import { env } from "../config/env";
import { logger } from "../config/logger";
import { ApiError } from "../utils/api-error";

let isBrevoConfigured = false;
let smtpTransporter: nodemailer.Transporter | null = null;

function extractErrorDetails(error: unknown) {
  if (!error || typeof error !== "object") {
    return { message: "Unknown error", rawType: typeof error };
  }

  const candidate = error as Error & {
    code?: string;
    command?: string;
    response?: string;
    responseCode?: number;
    status?: number;
    statusCode?: number;
    body?: unknown;
    stack?: string;
    cause?: unknown;
    text?: string;
    data?: unknown;
    output?: unknown;
    config?: unknown;
    request?: unknown;
    responseBody?: unknown;
  };

  const responseObject =
    typeof candidate.response === "object" && candidate.response !== null
      ? (candidate.response as { status?: number; statusCode?: number; data?: unknown; text?: string })
      : undefined;

  const cause =
    typeof candidate.cause === "object" && candidate.cause !== null
      ? (candidate.cause as { message?: string; code?: string; status?: number; statusCode?: number })
      : undefined;

  return {
    name: candidate.name ?? "Error",
    message: candidate.message ?? "Unknown error",
    code: candidate.code,
    status: candidate.status ?? candidate.statusCode ?? responseObject?.status ?? responseObject?.statusCode,
    command: candidate.command,
    responseCode: candidate.responseCode,
    response: typeof candidate.response === "string" ? candidate.response : undefined,
    responseText: candidate.text ?? responseObject?.text,
    body: candidate.body ?? candidate.data ?? candidate.responseBody ?? responseObject?.data,
    causeMessage: cause?.message,
    causeCode: cause?.code,
    causeStatus: cause?.status ?? cause?.statusCode,
    stack: candidate.stack,
  };
}

function redactEmail(email: string) {
  const [localPart, domain] = email.split("@");
  if (!localPart || !domain) {
    return "redacted";
  }

  if (localPart.length <= 2) {
    return `**@${domain}`;
  }

  return `${localPart.slice(0, 2)}***@${domain}`;
}

function hasSmtpConfig() {
  return Boolean(env.SMTP_HOST && env.SMTP_USER && env.SMTP_PASS && env.FROM_EMAIL);
}

function hasBrevoApiConfig() {
  return Boolean(env.BREVO_API_KEY && env.SENDER_EMAIL);
}

function getSmtpTransporter() {
  if (!smtpTransporter) {
    smtpTransporter = nodemailer.createTransport({
      host: env.SMTP_HOST,
      port: env.SMTP_PORT,
      secure: env.SMTP_PORT === 465,
      auth: {
        user: env.SMTP_USER,
        pass: env.SMTP_PASS,
      },
    });
  }

  return smtpTransporter;
}

function getTransactionalEmailApi() {
  if (!isBrevoConfigured) {
    const client = SibApiV3Sdk.ApiClient.instance;
    client.authentications["api-key"].apiKey = env.BREVO_API_KEY;
    isBrevoConfigured = true;
  }

  return new SibApiV3Sdk.TransactionalEmailsApi();
}

function buildOtpHtmlTemplate(otpCode: string, expiryMinutes: number) {
  return `
  <div style="font-family: Arial, sans-serif; max-width: 540px; margin: 0 auto; color: #111827;">
    <h2 style="margin-bottom: 8px;">Your BookMyEvent Verification Code</h2>
    <p style="margin-top: 0;">Use the OTP below to continue your authentication flow.</p>
    <div style="font-size: 30px; font-weight: 700; letter-spacing: 6px; margin: 24px 0; padding: 14px 16px; background: #f3f4f6; border-radius: 8px; text-align: center;">
      ${otpCode}
    </div>
    <p style="margin: 0;">This OTP expires in ${expiryMinutes} minutes.</p>
    <p style="margin-top: 12px; color: #6b7280; font-size: 13px;">If you did not request this code, you can safely ignore this email.</p>
  </div>
  `;
}

export const emailOtpService = {
  sendOtp: async (payload: { toEmail: string; otpCode: string; expiryMinutes: number }) => {
    const otpHtml = buildOtpHtmlTemplate(payload.otpCode, payload.expiryMinutes);

    if (hasSmtpConfig()) {
      try {
        const transporter = getSmtpTransporter();
        await transporter.sendMail({
          from: env.FROM_EMAIL,
          to: payload.toEmail,
          subject: "Your BookMyEvent OTP",
          html: otpHtml,
        });

        logger.info(
          {
            provider: "smtp",
            email: redactEmail(payload.toEmail),
            fromEmailConfigured: Boolean(env.FROM_EMAIL),
          },
          "OTP email delivered",
        );
        return;
      } catch (error) {
        logger.error(
          {
            provider: "smtp",
            email: redactEmail(payload.toEmail),
            smtpHostConfigured: Boolean(env.SMTP_HOST),
            smtpUserConfigured: Boolean(env.SMTP_USER),
            smtpPassConfigured: Boolean(env.SMTP_PASS),
            fromEmailConfigured: Boolean(env.FROM_EMAIL),
            errorDetails: extractErrorDetails(error),
          },
          "Failed to send OTP email via SMTP relay",
        );
      }
    }

    if (hasBrevoApiConfig()) {
      const emailApi = getTransactionalEmailApi();

      const sendSmtpEmail = new SibApiV3Sdk.SendSmtpEmail();
      sendSmtpEmail.subject = "Your BookMyEvent OTP";
      sendSmtpEmail.sender = {
        email: env.SENDER_EMAIL,
        name: env.SENDER_NAME,
      };
      sendSmtpEmail.to = [{ email: payload.toEmail }];
      sendSmtpEmail.htmlContent = otpHtml;

      try {
        await emailApi.sendTransacEmail(sendSmtpEmail);

        logger.info(
          {
            provider: "brevo-api",
            email: redactEmail(payload.toEmail),
            senderEmailConfigured: Boolean(env.SENDER_EMAIL),
          },
          "OTP email delivered",
        );
        return;
      } catch (error) {
        logger.error(
          {
            provider: "brevo-api",
            email: redactEmail(payload.toEmail),
            senderEmailConfigured: Boolean(env.SENDER_EMAIL),
            brevoApiConfigured: Boolean(env.BREVO_API_KEY),
            errorDetails: extractErrorDetails(error),
          },
          "Failed to send OTP email via Brevo API",
        );
      }
    }

    logger.error(
      {
        hasSmtpConfig: hasSmtpConfig(),
        hasBrevoApiConfig: hasBrevoApiConfig(),
        email: payload.toEmail,
      },
      "No OTP email provider delivered the message",
    );

    if (env.OTP_DEV_FALLBACK_ENABLED) {
      logger.warn(
        {
          email: payload.toEmail,
          otpCode: payload.otpCode,
          expiryMinutes: payload.expiryMinutes,
        },
        "OTP dev fallback enabled. Using logged OTP instead of provider delivery",
      );
      return;
    }

    throw new ApiError(502, "Unable to send OTP email. Please try again shortly");
  },
};
