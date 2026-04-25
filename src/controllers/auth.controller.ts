import { authService } from "../services/auth.service";
import { sendSuccess } from "../utils/api-response";
import { asyncHandler } from "../utils/async-handler";

export const authController = {
  signupCustomer: asyncHandler(async (req, res) => {
    const user = await authService.signupCustomer(req.body);
    return sendSuccess(res, "Customer signup successful", { user }, 201);
  }),

  signupVendor: asyncHandler(async (req, res) => {
    const user = await authService.signupVendor(req.body);
    return sendSuccess(res, "Vendor signup successful", { user }, 201);
  }),

  loginCustomer: asyncHandler(async (req, res) => {
    const result = await authService.loginCustomer(req.body);
    return sendSuccess(res, "Customer login successful", result);
  }),

  loginVendor: asyncHandler(async (req, res) => {
    const result = await authService.loginVendor(req.body);
    return sendSuccess(res, "Vendor login successful", result);
  }),

  loginAdmin: asyncHandler(async (req, res) => {
    const result = await authService.loginAdmin(req.body);
    return sendSuccess(res, "Admin login successful", result);
  }),

  requestOtp: asyncHandler(async (req, res) => {
    const result = await authService.requestLoginOtp(req.body);
    return sendSuccess(res, "OTP sent to email", result);
  }),

  verifyOtp: asyncHandler(async (req, res) => {
    const result = await authService.verifyLoginOtp(req.body);
    return sendSuccess(res, "OTP verified", result);
  }),

  refreshToken: asyncHandler(async (req, res) => {
    const tokens = await authService.refreshAuthToken(req.body.refreshToken);
    return sendSuccess(res, "Token refreshed", tokens);
  }),

  logout: asyncHandler(async (req, res) => {
    await authService.logout(req.authUser!.id);
    return sendSuccess(res, "Logout successful", {});
  }),

  forgotPassword: asyncHandler(async (req, res) => {
    await authService.forgotPasswordPlaceholder(req.body.email);
    return sendSuccess(res, "Forgot password placeholder queued", {});
  }),
};
