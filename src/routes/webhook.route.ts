import { Router } from "express";
import { subscriptionController } from "../controllers/subscription.controller";

const webhookRouter = Router();

webhookRouter.post("/razorpay", subscriptionController.razorpayWebhook);

export { webhookRouter };
