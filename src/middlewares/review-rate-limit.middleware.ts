import rateLimit from "express-rate-limit";

export const reviewSubmissionRateLimit = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: 6,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: "Too many review submissions. Please try again in a few minutes.",
    data: {},
  },
});
