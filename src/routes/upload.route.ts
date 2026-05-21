import { Router } from "express";
import { uploadController } from "../controllers/upload.controller";
import { attachAuthIfPresent } from "../middlewares/auth.middleware";
import { imageUpload } from "../middlewares/upload.middleware";

const uploadRouter = Router();

uploadRouter.post(
  "/image",
  attachAuthIfPresent,
  imageUpload.single("file"),
  uploadController.uploadImage,
);

export { uploadRouter };
