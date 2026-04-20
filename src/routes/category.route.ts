import { Router } from "express";
import { categoryController } from "../controllers/category.controller";
import { requireAuth } from "../middlewares/auth.middleware";
import { requireRoles } from "../middlewares/roles.middleware";
import { validateRequest } from "../middlewares/validate-request.middleware";
import {
  categoryCreateSchema,
  categoryDeleteSchema,
  categoryUpdateSchema,
  subCategoryBulkCreateSchema,
  subCategoryDeleteSchema,
  subCategoryUpdateSchema,
} from "../validators/category.validator";

const categoryRouter = Router();

categoryRouter.get("/", categoryController.listCategories);
categoryRouter.post(
  "/",
  requireAuth,
  requireRoles(["super_admin", "vendor_admin", "accounts_admin"]),
  validateRequest(categoryCreateSchema),
  categoryController.createCategory,
);
categoryRouter.put(
  "/:categoryId",
  requireAuth,
  requireRoles(["super_admin", "vendor_admin", "accounts_admin"]),
  validateRequest(categoryUpdateSchema),
  categoryController.updateCategory,
);
categoryRouter.delete(
  "/:categoryId",
  requireAuth,
  requireRoles(["super_admin", "vendor_admin", "accounts_admin"]),
  validateRequest(categoryDeleteSchema),
  categoryController.deleteCategory,
);
categoryRouter.post(
  "/:categoryId/sub-categories",
  requireAuth,
  requireRoles(["super_admin", "vendor_admin", "accounts_admin"]),
  validateRequest(subCategoryBulkCreateSchema),
  categoryController.addSubCategories,
);
categoryRouter.put(
  "/:categoryId/sub-categories/:subCategoryId",
  requireAuth,
  requireRoles(["super_admin", "vendor_admin", "accounts_admin"]),
  validateRequest(subCategoryUpdateSchema),
  categoryController.updateSubCategory,
);
categoryRouter.delete(
  "/:categoryId/sub-categories/:subCategoryId",
  requireAuth,
  requireRoles(["super_admin", "vendor_admin", "accounts_admin"]),
  validateRequest(subCategoryDeleteSchema),
  categoryController.deleteSubCategory,
);

export { categoryRouter };
