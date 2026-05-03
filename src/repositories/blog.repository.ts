import { BlogModel } from "../models/blog.model";

const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

export const blogRepository = {
  create: (payload: Record<string, unknown>) => BlogModel.create(payload),
  findAll: (filters: Record<string, unknown> = {}) => {
    const query: Record<string, unknown> = {};
    const includeInactive = filters.includeInactive === true;

    if (!includeInactive) {
      query.isActive = true;
      query.publishedAt = { $lte: new Date() };
    }

    if (typeof filters.search === "string" && filters.search.trim()) {
      const regex = new RegExp(escapeRegExp(filters.search.trim()), "i");
      query.$or = [{ title: regex }, { excerpt: regex }, { content: regex }];
    }

    if (typeof filters.isFeatured === "boolean") {
      query.isFeatured = filters.isFeatured;
    }

    const limit = typeof filters.limit === "number" ? Math.max(1, Math.min(100, filters.limit)) : 20;

    return BlogModel.find(query).sort({ publishedAt: -1, createdAt: -1 }).limit(limit);
  },
  findById: (blogId: string) => BlogModel.findById(blogId),
  findBySlug: (slug: string, includeInactive = false) => {
    const query: Record<string, unknown> = { slug: slug.trim().toLowerCase() };
    if (!includeInactive) {
      query.isActive = true;
      query.publishedAt = { $lte: new Date() };
    }
    return BlogModel.findOne(query);
  },
  updateById: (blogId: string, payload: Record<string, unknown>) =>
    BlogModel.findByIdAndUpdate(blogId, payload, { returnDocument: "after" }),
  deleteById: (blogId: string) => BlogModel.findByIdAndDelete(blogId),
};
