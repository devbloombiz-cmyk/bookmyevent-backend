import multer from "multer";
import path from "path";
import { ApiError } from "../utils/api-error";
import {
  isAllowedImageExtension,
  isAllowedImageMimeType,
  isMimeTypeExtensionCombinationValid,
  MAX_UPLOAD_FILE_SIZE_BYTES,
} from "../utils/s3";

export const imageUpload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: MAX_UPLOAD_FILE_SIZE_BYTES,
    files: 1,
  },
  fileFilter: (_req, file, cb) => {
    const extension = path.extname(file.originalname || "").toLowerCase();

    if (!isAllowedImageMimeType(file.mimetype) || !isAllowedImageExtension(extension)) {
      cb(new ApiError(400, "Only jpeg, png, and webp images are supported"));
      return;
    }

    if (!isMimeTypeExtensionCombinationValid(file.mimetype, extension)) {
      cb(new ApiError(400, "File extension does not match mime type"));
      return;
    }

    cb(null, true);
  },
});
