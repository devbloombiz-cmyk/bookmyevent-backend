import { Router } from "express";
import { PermissionKeys } from "../config/permissions";
import { categoryController } from "../controllers/category.controller";
import { requireAuth } from "../middlewares/auth.middleware";
import { authorize } from "../middlewares/authorize.middleware";
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
  authorize(PermissionKeys.CategoryManage),
  validateRequest(categoryCreateSchema),
  categoryController.createCategory,
);
categoryRouter.put(
  "/:categoryId",
  requireAuth,
  authorize(PermissionKeys.CategoryManage),
  validateRequest(categoryUpdateSchema),
  categoryController.updateCategory,
);
categoryRouter.delete(
  "/:categoryId",
  requireAuth,
  authorize(PermissionKeys.CategoryManage),
  validateRequest(categoryDeleteSchema),
  categoryController.deleteCategory,
);
categoryRouter.post(
  "/:categoryId/sub-categories",
  requireAuth,
  authorize(PermissionKeys.CategoryManage),
  validateRequest(subCategoryBulkCreateSchema),
  categoryController.addSubCategories,
);
categoryRouter.put(
  "/:categoryId/sub-categories/:subCategoryId",
  requireAuth,
  authorize(PermissionKeys.CategoryManage),
  validateRequest(subCategoryUpdateSchema),
  categoryController.updateSubCategory,
);
categoryRouter.delete(
  "/:categoryId/sub-categories/:subCategoryId",
  requireAuth,
  authorize(PermissionKeys.CategoryManage),
  validateRequest(subCategoryDeleteSchema),
  categoryController.deleteSubCategory,
);

export { categoryRouter };
