import { Router } from "express";
import { uploadController } from "../controllers/upload.controller";
import { requireAuth } from "../middlewares/auth.middleware";
import { requireRoles } from "../middlewares/roles.middleware";
import { imageUpload } from "../middlewares/upload.middleware";

const uploadRouter = Router();

uploadRouter.post(
	"/image",
	requireAuth,
	requireRoles(["vendor", "vendor_admin", "super_admin", "accounts_admin"]),
	imageUpload.single("file"),
	uploadController.uploadImage,
);

export { uploadRouter };
