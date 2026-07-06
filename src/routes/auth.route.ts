import { Router } from "express";
import { authController } from "../controllers/auth.controller";
import { requireAuth } from "../middlewares/auth.middleware";
import { otpSendRateLimit } from "../middlewares/otp-rate-limit.middleware";
import { loginRateLimit } from "../middlewares/login-rate-limit.middleware";
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
  loginRateLimit,
  validateRequest(customerSignupSchema),
  authController.signupCustomer,
);
authRouter.post(
  "/signup/vendor",
  loginRateLimit,
  validateRequest(vendorSignupSchema),
  authController.signupVendor,
);
authRouter.post(
  "/signup/venue-owner",
  loginRateLimit,
  validateRequest(venueOwnerSignupSchema),
  authController.signupVenueOwner,
);
authRouter.post(
  "/login/customer",
  loginRateLimit,
  validateRequest(loginSchema),
  authController.loginCustomer,
);
authRouter.post(
  "/login/vendor",
  loginRateLimit,
  validateRequest(loginSchema),
  authController.loginVendor,
);
authRouter.post(
  "/login/venue-owner",
  loginRateLimit,
  validateRequest(loginSchema),
  authController.loginVenueOwner,
);
authRouter.post(
  "/login/admin",
  loginRateLimit,
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
  loginRateLimit,
  validateRequest(forgotPasswordSchema),
  authController.forgotPassword,
);

export { authRouter };
