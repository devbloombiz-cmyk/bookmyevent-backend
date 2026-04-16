import { CategoryModel } from "../models/category.model";

export const categoryRepository = {
  create: (payload: Record<string, unknown>) => CategoryModel.create(payload),
  findAll: () => CategoryModel.find({ isActive: true }).sort({ name: 1 }),
};
