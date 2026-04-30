import { CategoryModel } from "../models/category.model";

export const categoryRepository = {
  create: (payload: Record<string, unknown>) => CategoryModel.create(payload),
  findAll: (includeInactive = false) =>
    CategoryModel.find(includeInactive ? {} : { isActive: true }).sort({ name: 1 }),
  findById: (categoryId: string) => CategoryModel.findById(categoryId),
  updateById: (categoryId: string, payload: Record<string, unknown>) =>
    CategoryModel.findByIdAndUpdate(categoryId, payload, { returnDocument: "after" }),
  deleteById: (categoryId: string) => CategoryModel.findByIdAndDelete(categoryId),
  addSubCategories: (categoryId: string, subCategories: Array<Record<string, unknown>>) =>
    CategoryModel.findByIdAndUpdate(
      categoryId,
      {
        $push: {
          subCategories: {
            $each: subCategories,
          },
        },
      },
      { returnDocument: "after" },
    ),
  updateSubCategory: (
    categoryId: string,
    subCategoryId: string,
    payload: Record<string, unknown>,
  ) =>
    CategoryModel.findOneAndUpdate(
      { _id: categoryId, "subCategories._id": subCategoryId },
      {
        $set: Object.fromEntries(
          Object.entries(payload).map(([key, value]) => [`subCategories.$.${key}`, value]),
        ),
      },
      { returnDocument: "after" },
    ),
  deleteSubCategory: (categoryId: string, subCategoryId: string) =>
    CategoryModel.findByIdAndUpdate(
      categoryId,
      {
        $pull: {
          subCategories: { _id: subCategoryId },
        },
      },
      { returnDocument: "after" },
    ),
};
