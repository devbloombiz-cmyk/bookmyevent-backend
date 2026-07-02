import { Router } from "express";
import { healthController } from "../controllers/health.controller";

const healthRouter = Router();

healthRouter.get("/health", healthController.getHealth);
healthRouter.get("/diagnostics", healthController.getDiagnostics);

export { healthRouter };
