import { blogService } from "../services/blog.service";
import { sendSuccess } from "../utils/api-response";
import { asyncHandler } from "../utils/async-handler";

export const blogController = {
  createBlog: asyncHandler(async (req, res) => {
    const blog = await blogService.createBlog(req.body);
    return sendSuccess(res, "Blog created", { blog }, 201);
  }),
  listBlogs: asyncHandler(async (req, res) => {
    const filters = {
      includeInactive: req.query.includeInactive === "true",
      search: req.query.search,
      isFeatured:
        req.query.isFeatured === "true"
          ? true
          : req.query.isFeatured === "false"
            ? false
            : undefined,
      limit: req.query.limit ? Number(req.query.limit) : undefined,
    };

    const blogs = await blogService.listBlogs(filters);
    return sendSuccess(res, "Blogs fetched", { blogs });
  }),
  getBlogBySlug: asyncHandler(async (req, res) => {
    const slug = String(req.params.slug);
    const includeInactive = req.query.includeInactive === "true";
    const blog = await blogService.getBlogBySlug(slug, includeInactive);
    return sendSuccess(res, "Blog fetched", { blog });
  }),
  updateBlog: asyncHandler(async (req, res) => {
    const blogId = String(req.params.blogId);
    const blog = await blogService.updateBlog(blogId, req.body);
    return sendSuccess(res, "Blog updated", { blog });
  }),
  deleteBlog: asyncHandler(async (req, res) => {
    const blogId = String(req.params.blogId);
    const blog = await blogService.deleteBlog(blogId);
    return sendSuccess(res, "Blog deleted", { blog });
  }),
};
