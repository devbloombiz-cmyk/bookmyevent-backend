import SibApiV3Sdk from "sib-api-v3-sdk";
import nodemailer from "nodemailer";
import { env } from "../config/env";
import { logger } from "../config/logger";
import { ApiError } from "../utils/api-error";

let isBrevoConfigured = false;
let smtpTransporter: nodemailer.Transporter | null = null;

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
        return;
      } catch (error) {
        logger.error({ error, email: payload.toEmail }, "Failed to send OTP email via SMTP relay");
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
        return;
      } catch (error) {
        logger.error({ error, email: payload.toEmail }, "Failed to send OTP email via Brevo API");
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
