import path from "path";
import multer from "multer";
import { uploadsConfig } from "../config/uploads";

function safeFileName(fileName: string) {
  return fileName
    .toLowerCase()
    .replace(/[^a-z0-9.\-_]/g, "-")
    .replace(/-+/g, "-");
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, uploadsConfig.imagesDir);
  },
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname || "").toLowerCase();
    const base = path.basename(file.originalname || "image", ext);
    cb(null, `${Date.now()}-${safeFileName(base)}${ext}`);
  },
});

const allowedMimeTypes = new Set(["image/jpeg", "image/png", "image/webp"]);

export const imageUpload = multer({
  storage,
  limits: {
    fileSize: 5 * 1024 * 1024,
    files: 1,
  },
  fileFilter: (_req, file, cb) => {
    if (!allowedMimeTypes.has(file.mimetype)) {
      cb(new Error("Only jpg, png, and webp images are supported"));
      return;
    }
    cb(null, true);
  },
});
