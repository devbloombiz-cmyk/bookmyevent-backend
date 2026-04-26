import { Router } from "express";
import { PermissionKeys } from "../config/permissions";
import { galleryController } from "../controllers/gallery.controller";
import { requireAuth } from "../middlewares/auth.middleware";
import { authorize } from "../middlewares/authorize.middleware";
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
  authorize(PermissionKeys.GalleryWrite),
  validateRequest(createGallerySchema),
  galleryController.createGalleryItem,
);
galleryRouter.put(
  "/:galleryId",
  requireAuth,
  authorize(PermissionKeys.GalleryWrite),
  validateRequest(updateGallerySchema),
  galleryController.updateGalleryItem,
);
galleryRouter.delete(
  "/:galleryId",
  requireAuth,
  authorize(PermissionKeys.GalleryWrite),
  validateRequest(deleteGallerySchema),
  galleryController.deleteGalleryItem,
);

export { galleryRouter };
