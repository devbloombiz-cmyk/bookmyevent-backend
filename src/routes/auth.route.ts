import { Router } from "express";
import { authController } from "../controllers/auth.controller";
import { requireAuth } from "../middlewares/auth.middleware";
import { otpSendRateLimit } from "../middlewares/otp-rate-limit.middleware";
import { authRateLimiter } from "../middlewares/rate-limit.middleware";
import { validateRequest } from "../middlewares/validate-request.middleware";
import {
  customerSignupSchema,
  forgotPasswordSchema,
  loginSchema,
  requestOtpSchema,
  refreshTokenSchema,
  verifyOtpSchema,
  venueOwnerSignupSchema,
  vendorSignupSchema,
} from "../validators/auth.validator";

const authRouter = Router();

authRouter.post(
  "/signup/customer",
  authRateLimiter,
  validateRequest(customerSignupSchema),
  authController.signupCustomer,
);
authRouter.post(
  "/signup/vendor",
  authRateLimiter,
  validateRequest(vendorSignupSchema),
  authController.signupVendor,
);
authRouter.post(
  "/signup/venue-owner",
  authRateLimiter,
  validateRequest(venueOwnerSignupSchema),
  authController.signupVenueOwner,
);
authRouter.post(
  "/login/customer",
  authRateLimiter,
  validateRequest(loginSchema),
  authController.loginCustomer,
);
authRouter.post(
  "/login/vendor",
  authRateLimiter,
  validateRequest(loginSchema),
  authController.loginVendor,
);
authRouter.post(
  "/login/venue-owner",
  authRateLimiter,
  validateRequest(loginSchema),
  authController.loginVenueOwner,
);
authRouter.post(
  "/login/admin",
  authRateLimiter,
  validateRequest(loginSchema),
  authController.loginAdmin,
);
authRouter.post(
  "/send-otp",
  otpSendRateLimit,
  validateRequest(requestOtpSchema),
  authController.requestOtp,
);
authRouter.post(
  "/request-otp",
  otpSendRateLimit,
  validateRequest(requestOtpSchema),
  authController.requestOtp,
);
authRouter.post("/verify-otp", validateRequest(verifyOtpSchema), authController.verifyOtp);
authRouter.post("/refresh-token", validateRequest(refreshTokenSchema), authController.refreshToken);
authRouter.post("/logout", authController.logout);
authRouter.get("/session", requireAuth, authController.getSession);
authRouter.post(
  "/forgot-password",
  authRateLimiter,
  validateRequest(forgotPasswordSchema),
  authController.forgotPassword,
);

export { authRouter };
