import { galleryService } from "../services/gallery.service";
import { sendSuccess } from "../utils/api-response";
import { asyncHandler } from "../utils/async-handler";

export const galleryController = {
  createGalleryItem: asyncHandler(async (req, res) => {
    const galleryItem = await galleryService.createGalleryItem(req.body);
    return sendSuccess(res, "Gallery item created", { galleryItem }, 201);
  }),
  listGalleryItems: asyncHandler(async (req, res) => {
    const items = await galleryService.listGalleryItems(req.query as Record<string, unknown>);
    return sendSuccess(res, "Gallery fetched", { items });
  }),
  updateGalleryItem: asyncHandler(async (req, res) => {
    const galleryId = String(req.params.galleryId);
    const galleryItem = await galleryService.updateGalleryItem(galleryId, req.body);
    return sendSuccess(res, "Gallery item updated", { galleryItem });
  }),
  deleteGalleryItem: asyncHandler(async (req, res) => {
    const galleryId = String(req.params.galleryId);
    const galleryItem = await galleryService.deleteGalleryItem(galleryId);
    return sendSuccess(res, "Gallery item deleted", { galleryItem });
  }),
};
