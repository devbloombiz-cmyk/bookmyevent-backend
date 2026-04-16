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

export const loginSchema = z.object({
  body: authBodySchema.pick({ email: true, password: true }),
  query: z.object({}),
  params: z.object({}),
});

export const refreshTokenSchema = z.object({
  body: z.object({ refreshToken: z.string().min(20) }),
  query: z.object({}),
  params: z.object({}),
});

export const forgotPasswordSchema = z.object({
  body: z.object({ email: z.email() }),
  query: z.object({}),
  params: z.object({}),
});

export const requestOtpSchema = z.object({
  body: z.object({
    mobile: z.string().min(8).max(20),
    email: z.email().optional(),
  }),
  query: z.object({}),
  params: z.object({}),
});

export const verifyOtpSchema = z.object({
  body: z.object({
    mobile: z.string().min(8).max(20),
    otp: z.string().length(6),
  }),
  query: z.object({}),
  params: z.object({}),
});
