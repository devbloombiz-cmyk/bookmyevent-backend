import { Router } from "express";
import { galleryController } from "../controllers/gallery.controller";
import { requireAuth } from "../middlewares/auth.middleware";
import { requireRoles } from "../middlewares/roles.middleware";
import { validateRequest } from "../middlewares/validate-request.middleware";
import { createGallerySchema, listGallerySchema } from "../validators/gallery.validator";

const galleryRouter = Router();

galleryRouter.get("/", validateRequest(listGallerySchema), galleryController.listGalleryItems);

galleryRouter.post(
  "/",
  requireAuth,
  requireRoles(["vendor", "vendor_admin", "super_admin", "accounts_admin"]),
  validateRequest(createGallerySchema),
  galleryController.createGalleryItem,
);

export { galleryRouter };
