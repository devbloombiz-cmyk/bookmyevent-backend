import { categoryService } from "../services/category.service";
import { sendSuccess } from "../utils/api-response";
import { asyncHandler } from "../utils/async-handler";

export const categoryController = {
  createCategory: asyncHandler(async (req, res) => {
    const category = await categoryService.createCategory(req.body);
    return sendSuccess(res, "Category created", { category }, 201);
  }),
  listCategories: asyncHandler(async (_req, res) => {
    const categories = await categoryService.listCategories();
    return sendSuccess(res, "Categories fetched", { categories });
  }),
};
