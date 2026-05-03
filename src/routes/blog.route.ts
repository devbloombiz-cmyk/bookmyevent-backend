import { Router } from "express";
import { PermissionKeys } from "../config/permissions";
import { blogController } from "../controllers/blog.controller";
import { requireAuth } from "../middlewares/auth.middleware";
import { authorize } from "../middlewares/authorize.middleware";
import { validateRequest } from "../middlewares/validate-request.middleware";
import {
  blogBySlugSchema,
  createBlogSchema,
  deleteBlogSchema,
  listBlogSchema,
  updateBlogSchema,
} from "../validators/blog.validator";

const blogRouter = Router();

blogRouter.get("/", validateRequest(listBlogSchema), blogController.listBlogs);
blogRouter.get("/slug/:slug", validateRequest(blogBySlugSchema), blogController.getBlogBySlug);
blogRouter.post(
  "/",
  requireAuth,
  authorize(PermissionKeys.CategoryManage),
  validateRequest(createBlogSchema),
  blogController.createBlog,
);
blogRouter.put(
  "/:blogId",
  requireAuth,
  authorize(PermissionKeys.CategoryManage),
  validateRequest(updateBlogSchema),
  blogController.updateBlog,
);
blogRouter.delete(
  "/:blogId",
  requireAuth,
  authorize(PermissionKeys.CategoryManage),
  validateRequest(deleteBlogSchema),
  blogController.deleteBlog,
);

export { blogRouter };
