import { Router } from "express";
import { subscriptionController } from "../controllers/subscription.controller";
import { webhookRateLimiter } from "../middlewares/rate-limit.middleware";

const webhookRouter = Router();

webhookRouter.post("/razorpay", webhookRateLimiter, subscriptionController.razorpayWebhook);

export { webhookRouter };
