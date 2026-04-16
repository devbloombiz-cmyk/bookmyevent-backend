import { Router } from "express";
import { categoryController } from "../controllers/category.controller";
import { requireAuth } from "../middlewares/auth.middleware";
import { requireRoles } from "../middlewares/roles.middleware";
import { validateRequest } from "../middlewares/validate-request.middleware";
import { categoryCreateSchema } from "../validators/category.validator";

const categoryRouter = Router();

categoryRouter.get("/", categoryController.listCategories);
categoryRouter.post(
  "/",
  requireAuth,
  requireRoles(["super_admin", "vendor_admin", "accounts_admin"]),
  validateRequest(categoryCreateSchema),
  categoryController.createCategory,
);

export { categoryRouter };
