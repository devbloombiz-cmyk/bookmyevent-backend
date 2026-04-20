import { Router } from "express";
import { galleryController } from "../controllers/gallery.controller";
import { requireAuth } from "../middlewares/auth.middleware";
import { requireRoles } from "../middlewares/roles.middleware";
import { validateRequest } from "../middlewares/validate-request.middleware";
import {
  createGallerySchema,
  deleteGallerySchema,
  listGallerySchema,
  updateGallerySchema,
} from "../validators/gallery.validator";

const galleryRouter = Router();

galleryRouter.get("/", validateRequest(listGallerySchema), galleryController.listGalleryItems);

galleryRouter.post(
  "/",
  requireAuth,
  requireRoles(["vendor", "vendor_admin", "super_admin", "accounts_admin"]),
  validateRequest(createGallerySchema),
  galleryController.createGalleryItem,
);
galleryRouter.put(
  "/:galleryId",
  requireAuth,
  requireRoles(["vendor", "vendor_admin", "super_admin", "accounts_admin"]),
  validateRequest(updateGallerySchema),
  galleryController.updateGalleryItem,
);
galleryRouter.delete(
  "/:galleryId",
  requireAuth,
  requireRoles(["vendor", "vendor_admin", "super_admin", "accounts_admin"]),
  validateRequest(deleteGallerySchema),
  galleryController.deleteGalleryItem,
);

export { galleryRouter };
