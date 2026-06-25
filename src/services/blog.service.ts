import { blogRepository } from "../repositories/blog.repository";
import { ApiError } from "../utils/api-error";
import { deleteFromS3 } from "../utils/s3";
import { logger } from "../config/logger";

function slugify(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");
}

function normalizeText(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function normalizePayload(payload: Record<string, unknown>, options: { partial: boolean }) {
  const normalized: Record<string, unknown> = { ...payload };

  if (!options.partial || "title" in payload) {
    normalized.title = normalizeText(payload.title);
  }

  if (!options.partial || "slug" in payload || "title" in payload) {
    const baseSlug = normalizeText(payload.slug) || normalizeText(payload.title);
    normalized.slug = slugify(baseSlug);
  }

  if (!options.partial || "excerpt" in payload) {
    normalized.excerpt = normalizeText(payload.excerpt);
  }

  if (!options.partial || "content" in payload) {
    normalized.content = normalizeText(payload.content);
  }

  if (!options.partial || "coverImage" in payload) {
    normalized.coverImage = normalizeText(payload.coverImage);
  }

  if (!options.partial || "tags" in payload) {
    normalized.tags = Array.isArray(payload.tags)
      ? payload.tags
          .filter((item): item is string => typeof item === "string")
          .map((item) => item.trim())
          .filter(Boolean)
      : [];
  }

  if (!options.partial || "publishedAt" in payload) {
    const raw = payload.publishedAt;
    if (raw instanceof Date) {
      normalized.publishedAt = raw;
    } else if (typeof raw === "string" && raw.trim()) {
      const date = new Date(raw);
      if (!Number.isNaN(date.getTime())) {
        normalized.publishedAt = date;
      }
    }
  }

  return normalized;
}

export const blogService = {
  createBlog: async (payload: Record<string, unknown>) => {
    const normalized = normalizePayload(payload, { partial: false });

    const existing = await blogRepository.findBySlug(String(normalized.slug || ""), true);
    if (existing) {
      throw new ApiError(409, "Blog slug already exists");
    }

    return blogRepository.create(normalized);
  },
  listBlogs: (filters: Record<string, unknown>) => blogRepository.findAll(filters),
  getBlogBySlug: async (slug: string, includeInactive = false) => {
    const blog = await blogRepository.findBySlug(slug, includeInactive);
    if (!blog) {
      throw new ApiError(404, "Blog not found");
    }
    return blog;
  },
  updateBlog: async (blogId: string, payload: Record<string, unknown>) => {
    const existingBlog = await blogRepository.findById(blogId);
    if (!existingBlog) {
      throw new ApiError(404, "Blog not found");
    }

    const normalized = normalizePayload(payload, { partial: true });

    if (normalized.slug) {
      const existingWithSlug = await blogRepository.findBySlug(String(normalized.slug), true);
      if (existingWithSlug && String(existingWithSlug._id) !== blogId) {
        throw new ApiError(409, "Blog slug already exists");
      }
    }

    const blog = await blogRepository.updateById(blogId, normalized);
    if (!blog) {
      throw new ApiError(404, "Blog not found");
    }

    if ("coverImage" in normalized) {
      const oldCover = String(existingBlog.coverImage || "").trim();
      const newCover = String(normalized.coverImage || "").trim();
      if (oldCover && oldCover !== newCover) {
        deleteFromS3(oldCover).catch((err) => {
          logger.error({ err, oldCover }, "Error in updateBlog S3 cleanup");
        });
      }
    }

    return blog;
  },
  deleteBlog: async (blogId: string) => {
    const blog = await blogRepository.deleteById(blogId);
    if (!blog) {
      throw new ApiError(404, "Blog not found");
    }

    if (blog.coverImage) {
      deleteFromS3(String(blog.coverImage)).catch((err) => {
        logger.error(
          { err, coverImage: blog.coverImage },
          "Error deleting blog coverImage from S3",
        );
      });
    }

    return blog;
  },
};
