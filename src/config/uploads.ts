import fs from "fs";
import path from "path";

const uploadRoot = path.resolve(process.cwd(), "uploads");
const imagesDir = path.join(uploadRoot, "images");

export function ensureUploadDirectories() {
  if (!fs.existsSync(uploadRoot)) {
    fs.mkdirSync(uploadRoot, { recursive: true });
  }

  if (!fs.existsSync(imagesDir)) {
    fs.mkdirSync(imagesDir, { recursive: true });
  }
}

export const uploadsConfig = {
  uploadRoot,
  imagesDir,
};
