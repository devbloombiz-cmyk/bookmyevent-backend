import { Router } from "express";
import { PermissionKeys } from "../config/permissions";
import { uploadController } from "../controllers/upload.controller";
import { requireAuth } from "../middlewares/auth.middleware";
import { authorize } from "../middlewares/authorize.middleware";
import { imageUpload } from "../middlewares/upload.middleware";

const uploadRouter = Router();

uploadRouter.post(
	"/image",
	requireAuth,
	authorize(PermissionKeys.UploadImage),
	imageUpload.single("file"),
	uploadController.uploadImage,
);

export { uploadRouter };
