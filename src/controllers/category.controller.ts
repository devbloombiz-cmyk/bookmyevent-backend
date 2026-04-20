import { categoryService } from "../services/category.service";
import { sendSuccess } from "../utils/api-response";
import { asyncHandler } from "../utils/async-handler";

export const categoryController = {
  createCategory: asyncHandler(async (req, res) => {
    const category = await categoryService.createCategory(req.body);
    return sendSuccess(res, "Category created", { category }, 201);
  }),
  listCategories: asyncHandler(async (req, res) => {
    const includeInactive = req.query.includeInactive === "true";
    const categories = await categoryService.listCategories(includeInactive);
    return sendSuccess(res, "Categories fetched", { categories });
  }),
  updateCategory: asyncHandler(async (req, res) => {
    const categoryId = String(req.params.categoryId);
    const category = await categoryService.updateCategory(categoryId, req.body);
    return sendSuccess(res, "Category updated", { category });
  }),
  deleteCategory: asyncHandler(async (req, res) => {
    const categoryId = String(req.params.categoryId);
    const category = await categoryService.deleteCategory(categoryId);
    return sendSuccess(res, "Category deleted", { category });
  }),
  addSubCategories: asyncHandler(async (req, res) => {
    const categoryId = String(req.params.categoryId);
    const category = await categoryService.addSubCategories(
      categoryId,
      req.body.subCategories,
    );
    return sendSuccess(res, "Sub categories added", { category });
  }),
  updateSubCategory: asyncHandler(async (req, res) => {
    const categoryId = String(req.params.categoryId);
    const subCategoryId = String(req.params.subCategoryId);
    const category = await categoryService.updateSubCategory(
      categoryId,
      subCategoryId,
      req.body,
    );
    return sendSuccess(res, "Sub category updated", { category });
  }),
  deleteSubCategory: asyncHandler(async (req, res) => {
    const categoryId = String(req.params.categoryId);
    const subCategoryId = String(req.params.subCategoryId);
    const category = await categoryService.deleteSubCategory(
      categoryId,
      subCategoryId,
    );
    return sendSuccess(res, "Sub category deleted", { category });
  }),
};
