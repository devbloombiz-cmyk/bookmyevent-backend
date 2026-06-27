import { env } from "../../../config/env";
import { logger } from "../../../config/logger";
import { getRedisClient } from "../../../config/redis";
import { ApiError } from "../../../utils/api-error";

type UltraMsgSendMessagePayload = {
  to: string;
  body: string;
  context:
    | "auth_otp"
    | "booking_confirmation"
    | "vendor_lead_notification"
    | "vendor_approval"
    | "venue_owner_approval"
    | "customer_lead_accepted"
    | "customer_lead_rejected";
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

async function sendRequestWithRetry(
  payload: UltraMsgSendMessagePayload,
  retriesRemaining = 3,
  delayMs = 1000,
): Promise<UltraMsgApiResponse> {
  try {
    return await sendUltraMsgRequest(payload);
  } catch (error) {
    if (error instanceof ApiError && error.statusCode === 400) {
      throw error;
    }

    if (retriesRemaining <= 1) {
      throw error;
    }

    logger.warn(
      {
        provider: "ultramsg",
        context: payload.context,
        retriesRemaining: retriesRemaining - 1,
        nextDelayMs: delayMs * 2,
        error: error instanceof Error ? error.message : String(error),
      },
      "UltraMsg request failed, retrying...",
    );

    await new Promise((resolve) => setTimeout(resolve, delayMs));
    return sendRequestWithRetry(payload, retriesRemaining - 1, delayMs * 2);
  }
}

type BackgroundJob = {
  id: string;
  payload: UltraMsgSendMessagePayload;
  attempts: number;
  maxAttempts: number;
  nextRun: number;
};

const REDIS_QUEUE_KEY = "whatsapp:queue:delayed";
const backgroundQueue: BackgroundJob[] = [];
let isQueueProcessorActive = false;

function generateJobId() {
  return Math.random().toString(36).substring(2, 15) + Date.now().toString(36);
}

async function processBackgroundQueue() {
  if (isQueueProcessorActive) {
    return;
  }
  isQueueProcessorActive = true;

  try {
    const redisClient = getRedisClient();

    // 1. Process Redis queue if client is active
    if (redisClient) {
      while (true) {
        const now = Date.now();
        const readyJobs = await redisClient.zrangebyscore(
          REDIS_QUEUE_KEY,
          "-inf",
          String(now),
          "LIMIT",
          0,
          1,
        );

        if (!readyJobs || readyJobs.length === 0) {
          break;
        }

        const jobString = readyJobs[0];
        const removed = await redisClient.zrem(REDIS_QUEUE_KEY, jobString);
        if (removed === 0) {
          continue; // Claimed by another replica
        }

        let job: BackgroundJob;
        try {
          job = JSON.parse(jobString) as BackgroundJob;
        } catch {
          logger.error({ jobString }, "Invalid job format in Redis queue");
          continue;
        }

        try {
          await sendRequestWithRetry(job.payload, 1);
          logger.info(
            {
              provider: "ultramsg",
              context: job.payload.context,
              to: maskWhatsappNumber(job.payload.to),
              attempts: job.attempts + 1,
            },
            "Background WhatsApp message delivered successfully via Redis Queue",
          );
        } catch (error) {
          const nextAttempts = job.attempts + 1;
          if (nextAttempts >= job.maxAttempts) {
            logger.error(
              {
                provider: "ultramsg",
                context: job.payload.context,
                to: maskWhatsappNumber(job.payload.to),
                attempts: nextAttempts,
                error: error instanceof Error ? error.message : String(error),
              },
              "Background WhatsApp message permanently failed after max retries via Redis Queue",
            );
          } else {
            const backoffDelay = Math.pow(2, nextAttempts) * 1000;
            job.attempts = nextAttempts;
            job.nextRun = Date.now() + backoffDelay;
            await redisClient.zadd(REDIS_QUEUE_KEY, job.nextRun, JSON.stringify(job));
            logger.warn(
              {
                provider: "ultramsg",
                context: job.payload.context,
                to: maskWhatsappNumber(job.payload.to),
                attempts: nextAttempts,
                nextAttemptInMs: backoffDelay,
              },
              "Rescheduling background WhatsApp message after transient failure via Redis Queue",
            );
          }
        }
      }
    }

    // 2. Process local in-memory fallback
    while (backgroundQueue.length > 0) {
      const now = Date.now();
      const jobIndex = backgroundQueue.findIndex((job) => job.nextRun <= now);
      if (jobIndex === -1) {
        break;
      }

      const [job] = backgroundQueue.splice(jobIndex, 1);
      try {
        await sendRequestWithRetry(job.payload, 1);
        logger.info(
          {
            provider: "ultramsg",
            context: job.payload.context,
            to: maskWhatsappNumber(job.payload.to),
            attempts: job.attempts + 1,
          },
          "Background WhatsApp message delivered successfully via In-Memory Queue",
        );
      } catch (error) {
        const nextAttempts = job.attempts + 1;
        if (nextAttempts >= job.maxAttempts) {
          logger.error(
            {
              provider: "ultramsg",
              context: job.payload.context,
              to: maskWhatsappNumber(job.payload.to),
              attempts: nextAttempts,
              error: error instanceof Error ? error.message : String(error),
            },
            "Background WhatsApp message permanently failed after max retries via In-Memory Queue",
          );
        } else {
          const backoffDelay = Math.pow(2, nextAttempts) * 1000;
          job.attempts = nextAttempts;
          job.nextRun = Date.now() + backoffDelay;
          backgroundQueue.push(job);
          logger.warn(
            {
              provider: "ultramsg",
              context: job.payload.context,
              to: maskWhatsappNumber(job.payload.to),
              attempts: nextAttempts,
              nextAttemptInMs: backoffDelay,
            },
            "Rescheduling background WhatsApp message after transient failure via In-Memory Queue",
          );
        }
      }
    }
  } finally {
    isQueueProcessorActive = false;
  }
}

async function queueBackgroundMessage(payload: UltraMsgSendMessagePayload) {
  const job: BackgroundJob = {
    id: generateJobId(),
    payload,
    attempts: 0,
    maxAttempts: 3,
    nextRun: Date.now(),
  };

  const redisClient = getRedisClient();
  if (redisClient) {
    try {
      await redisClient.zadd(REDIS_QUEUE_KEY, job.nextRun, JSON.stringify(job));
      logger.info(
        { provider: "ultramsg", context: payload.context, to: maskWhatsappNumber(payload.to) },
        "Queued WhatsApp notification in Redis Sorted Set",
      );
    } catch (err) {
      logger.error(
        { err },
        "Failed to write WhatsApp job to Redis; falling back to in-memory queue",
      );
      backgroundQueue.push(job);
    }
  } else {
    backgroundQueue.push(job);
  }

  processBackgroundQueue().catch((err) => {
    logger.error({ err }, "Error running background WhatsApp queue processor");
  });
}

// Start periodic polling tick every 10 seconds to process ready delayed queue items
setInterval(() => {
  processBackgroundQueue().catch((err) => {
    logger.error({ err }, "Error during periodic background WhatsApp queue tick");
  });
}, 10000).unref();

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
    const normalizedPayload = {
      ...payload,
      to: normalizedMobile,
    };

    if (payload.context === "auth_otp") {
      const result = await sendRequestWithRetry(normalizedPayload, 3, 1000);
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
    }

    await queueBackgroundMessage(normalizedPayload);

    return {
      provider: "ultramsg",
      to: normalizedMobile,
      queued: true,
    };
  },
};
