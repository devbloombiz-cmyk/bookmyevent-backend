import { categoryRepository } from "../repositories/category.repository";

export const categoryService = {
  createCategory: (payload: Record<string, unknown>) => categoryRepository.create(payload),
  listCategories: () => categoryRepository.findAll(),
};
