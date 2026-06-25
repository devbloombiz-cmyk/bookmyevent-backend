import { env } from "../../../config/env";
import { logger } from "../../../config/logger";
import { ApiError } from "../../../utils/api-error";

type UltraMsgSendMessagePayload = {
  to: string;
  body: string;
  context:
    | "auth_otp"
    | "booking_confirmation"
    | "vendor_lead_notification"
    | "vendor_approval"
    | "venue_owner_approval";
};

type UltraMsgApiResponse = {
  id?: string;
  sent?: string;
  message?: string;
  error?: string;
};

function trimTrailingSlash(value: string) {
  return value.endsWith("/") ? value.slice(0, -1) : value;
}

function normalizeWhatsappNumber(rawMobile: string) {
  let source = String(rawMobile || "").trim();

  // Handle double-zero prefix
  if (source.startsWith("00")) {
    source = "+" + source.slice(2);
  }

  const startsWithPlus = source.startsWith("+");
  let digitsOnly = source.replace(/\D/g, "");

  // If no plus sign, analyze if we need to prepend country code
  if (!startsWithPlus) {
    const isIndianWithCode = digitsOnly.length === 12 && digitsOnly.startsWith("91");
    const isUaeWithCode = digitsOnly.length === 12 && digitsOnly.startsWith("971");

    if (!isIndianWithCode && !isUaeWithCode) {
      if (digitsOnly.length === 10) {
        if (digitsOnly.startsWith("0")) {
          // UAE local format: e.g., 05XXXXXXXX -> 9715XXXXXXXX
          digitsOnly = "971" + digitsOnly.slice(1);
        } else {
          // Indian format: e.g., 9847882076 -> 919847882076
          digitsOnly = "91" + digitsOnly;
        }
      } else if (digitsOnly.length === 9) {
        // UAE format: e.g., 50XXXXXXX -> 97150XXXXXXX
        digitsOnly = "971" + digitsOnly;
      }
    }
  }

  if (digitsOnly.length < 8 || digitsOnly.length > 15) {
    throw new ApiError(400, "Invalid mobile number for WhatsApp delivery");
  }

  // UltraMsg expects digits only without '+' sign prefix
  return digitsOnly;
}

function maskWhatsappNumber(mobile: string) {
  const digitsOnly = mobile.replace(/\D/g, "");
  if (digitsOnly.length <= 4) {
    return "****";
  }

  return `${digitsOnly.slice(0, 2)}****${digitsOnly.slice(-2)}`;
}

function extractErrorDetails(error: unknown) {
  if (!error || typeof error !== "object") {
    return { message: "Unknown error", rawType: typeof error };
  }

  const candidate = error as Error & { name?: string; message?: string; stack?: string };
  return {
    name: candidate.name ?? "Error",
    message: candidate.message ?? "Unknown error",
    stack: candidate.stack,
  };
}

async function sendUltraMsgRequest(payload: UltraMsgSendMessagePayload) {
  const baseUrl = trimTrailingSlash(env.ULTRAMSG_BASE_URL);
  const endpoint = `${baseUrl}/${env.ULTRAMSG_INSTANCE}/messages/chat`;
  const timeoutMs = env.ULTRAMSG_TIMEOUT_MS;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        token: env.ULTRAMSG_TOKEN,
        to: payload.to,
        body: payload.body,
        priority: 10,
      }),
      signal: controller.signal,
    });

    const responseJson = (await response.json().catch(() => ({}))) as UltraMsgApiResponse;

    if (!response.ok) {
      logger.error(
        {
          provider: "ultramsg",
          context: payload.context,
          status: response.status,
          response: responseJson,
        },
        "UltraMsg message delivery failed",
      );
      throw new ApiError(502, "Unable to send WhatsApp message. Please try again shortly");
    }

    return responseJson;
  } catch (error) {
    const isAbortError = error instanceof Error && error.name === "AbortError";
    logger.error(
      {
        provider: "ultramsg",
        context: payload.context,
        timeoutMs,
        isAbortError,
        errorDetails: extractErrorDetails(error),
      },
      "UltraMsg request failed",
    );

    if (isAbortError) {
      throw new ApiError(504, "WhatsApp delivery timed out. Please try again shortly");
    }

    if (error instanceof ApiError) {
      throw error;
    }

    throw new ApiError(502, "Unable to send WhatsApp message. Please try again shortly");
  } finally {
    clearTimeout(timer);
  }
}

export const ultramsgWhatsappService = {
  isEnabled: () =>
    Boolean(
      env.ULTRAMSG_ENABLED && env.ULTRAMSG_TOKEN && env.ULTRAMSG_INSTANCE && env.ULTRAMSG_BASE_URL,
    ),

  sendMessage: async (payload: UltraMsgSendMessagePayload) => {
    if (!ultramsgWhatsappService.isEnabled()) {
      throw new ApiError(503, "WhatsApp notification provider is not configured");
    }

    const normalizedMobile = normalizeWhatsappNumber(payload.to);
    const result = await sendUltraMsgRequest({
      ...payload,
      to: normalizedMobile,
    });

    logger.info(
      {
        provider: "ultramsg",
        context: payload.context,
        to: maskWhatsappNumber(normalizedMobile),
        providerMessageId: result.id,
      },
      "WhatsApp message delivered",
    );

    return {
      provider: "ultramsg",
      to: normalizedMobile,
      providerMessageId: result.id,
    };
  },
};
