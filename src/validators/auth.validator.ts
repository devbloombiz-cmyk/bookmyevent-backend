import { z } from "zod";

const authBodySchema = z.object({
  name: z.string().min(2).optional(),
  email: z.email(),
  mobile: z.string().min(8).max(20).optional(),
  password: z.string().min(8).max(72),
});

export const customerSignupSchema = z.object({
  body: authBodySchema.extend({
    name: z.string().min(2),
    mobile: z.string().min(8).max(20),
  }),
  query: z.object({}),
  params: z.object({}),
});

export const vendorSignupSchema = customerSignupSchema;
export const venueOwnerSignupSchema = customerSignupSchema;

export const loginSchema = z.object({
  body: z
    .object({
      identifier: z.string().min(3).optional(),
      email: z.email().optional(),
      mobile: z.string().min(8).max(20).optional(),
      password: authBodySchema.shape.password,
    })
    .refine((payload) => Boolean(payload.identifier || payload.email || payload.mobile), {
      message: "Provide identifier, email, or mobile",
    }),
  query: z.object({}),
  params: z.object({}),
});

export const refreshTokenSchema = z.object({
  body: z.object({ refreshToken: z.string().min(20).optional() }),
  query: z.object({}),
  params: z.object({}),
});

export const forgotPasswordSchema = z.object({
  body: z.object({ email: z.email() }),
  query: z.object({}),
  params: z.object({}),
});

export const requestOtpSchema = z.object({
  body: z
    .object({
      identifier: z.string().min(3).optional(),
      email: z.email().optional(),
      mobile: z.string().min(8).max(20).optional(),
    })
    .refine((payload) => Boolean(payload.identifier || payload.email || payload.mobile), {
      message: "Provide identifier, email, or mobile",
    }),
  query: z.object({}),
  params: z.object({}),
});

export const verifyOtpSchema = z.object({
  body: z
    .object({
      identifier: z.string().min(3).optional(),
      email: z.email().optional(),
      mobile: z.string().min(8).max(20).optional(),
      otp: z.string().regex(/^\d{6}$/, "OTP must be a 6-digit numeric code"),
    })
    .refine((payload) => Boolean(payload.identifier || payload.email || payload.mobile), {
      message: "Provide identifier, email, or mobile",
    }),
  query: z.object({}),
  params: z.object({}),
});
