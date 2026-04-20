import { categoryRepository } from "../repositories/category.repository";
import { ApiError } from "../utils/api-error";

function normalizeName(value: string) {
  return value.trim().toLowerCase();
}

function normalizeSubCategoryPayload(payload: Record<string, unknown>) {
  const name = String(payload.name ?? "").trim();
  const displayName = String(payload.displayName ?? name).trim();

  return {
    ...payload,
    name: normalizeName(name),
    displayName,
  };
}

export const categoryService = {
  createCategory: (payload: Record<string, unknown>) => {
    const nextPayload = {
      ...payload,
      name: normalizeName(String(payload.name ?? "")),
      displayName: String(payload.displayName ?? payload.name ?? "").trim(),
      subCategories: Array.isArray(payload.subCategories)
        ? (payload.subCategories as Array<Record<string, unknown>>).map(normalizeSubCategoryPayload)
        : [],
    };

    return categoryRepository.create(nextPayload);
  },
  listCategories: (includeInactive = false) => categoryRepository.findAll(includeInactive),
  updateCategory: async (categoryId: string, payload: Record<string, unknown>) => {
    const nextPayload = {
      ...payload,
      ...(payload.name ? { name: normalizeName(String(payload.name)) } : {}),
      ...(payload.displayName ? { displayName: String(payload.displayName).trim() } : {}),
      ...(Array.isArray(payload.subCategories)
        ? {
            subCategories: (payload.subCategories as Array<Record<string, unknown>>).map(
              normalizeSubCategoryPayload,
            ),
          }
        : {}),
    };

    const category = await categoryRepository.updateById(categoryId, nextPayload);
    if (!category) {
      throw new ApiError(404, "Category not found");
    }

    return category;
  },
  deleteCategory: async (categoryId: string) => {
    const category = await categoryRepository.deleteById(categoryId);
    if (!category) {
      throw new ApiError(404, "Category not found");
    }

    return category;
  },
  addSubCategories: async (categoryId: string, subCategories: Array<Record<string, unknown>>) => {
    const normalized = subCategories.map(normalizeSubCategoryPayload);
    const category = await categoryRepository.addSubCategories(categoryId, normalized);

    if (!category) {
      throw new ApiError(404, "Category not found");
    }

    return category;
  },
  updateSubCategory: async (
    categoryId: string,
    subCategoryId: string,
    payload: Record<string, unknown>,
  ) => {
    const normalizedPayload = {
      ...payload,
      ...(payload.name ? { name: normalizeName(String(payload.name)) } : {}),
      ...(payload.displayName ? { displayName: String(payload.displayName).trim() } : {}),
    };

    const category = await categoryRepository.updateSubCategory(
      categoryId,
      subCategoryId,
      normalizedPayload,
    );

    if (!category) {
      throw new ApiError(404, "Category or subcategory not found");
    }

    return category;
  },
  deleteSubCategory: async (categoryId: string, subCategoryId: string) => {
    const category = await categoryRepository.deleteSubCategory(categoryId, subCategoryId);

    if (!category) {
      throw new ApiError(404, "Category not found");
    }

    return category;
  },
};
