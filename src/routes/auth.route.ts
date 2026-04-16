import { Router } from "express";
import { authController } from "../controllers/auth.controller";
import { requireAuth } from "../middlewares/auth.middleware";
import { validateRequest } from "../middlewares/validate-request.middleware";
import {
  customerSignupSchema,
  forgotPasswordSchema,
  loginSchema,
  requestOtpSchema,
  refreshTokenSchema,
  verifyOtpSchema,
  vendorSignupSchema,
} from "../validators/auth.validator";

const authRouter = Router();

authRouter.post("/signup/customer", validateRequest(customerSignupSchema), authController.signupCustomer);
authRouter.post("/signup/vendor", validateRequest(vendorSignupSchema), authController.signupVendor);
authRouter.post("/login/customer", validateRequest(loginSchema), authController.loginCustomer);
authRouter.post("/login/vendor", validateRequest(loginSchema), authController.loginVendor);
authRouter.post("/login/admin", validateRequest(loginSchema), authController.loginAdmin);
authRouter.post("/request-otp", validateRequest(requestOtpSchema), authController.requestOtp);
authRouter.post("/verify-otp", validateRequest(verifyOtpSchema), authController.verifyOtp);
authRouter.post("/refresh-token", validateRequest(refreshTokenSchema), authController.refreshToken);
authRouter.post("/logout", requireAuth, authController.logout);
authRouter.post("/forgot-password", validateRequest(forgotPasswordSchema), authController.forgotPassword);

export { authRouter };
