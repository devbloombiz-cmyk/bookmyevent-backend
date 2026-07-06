import rateLimit, { ipKeyGenerator } from "express-rate-limit";

export const loginRateLimit = rateLimit({
  windowMs: 5 * 60 * 1000, // 5 minutes
  max: 10, // Max 10 attempts
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    // Group by email/mobile (identifier) if present, else fall back to IP
    const body = req.body as { email?: string; mobile?: string; identifier?: string } | undefined;
    const identifier = body?.email ?? body?.mobile ?? body?.identifier;
    if (identifier && typeof identifier === "string" && identifier.trim()) {
      return `login:${identifier.trim().toLowerCase()}`;
    }
    const clientIp = ipKeyGenerator(req.ip || "127.0.0.1");
    return `login-ip:${clientIp}`;
  },
  handler: (_req, res) => {
    res.status(429).json({
      success: false,
      message: "Too many login attempts. Please try again after 5 minutes.",
      data: {},
    });
  },
});
