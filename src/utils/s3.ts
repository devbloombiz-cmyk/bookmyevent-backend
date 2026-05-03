import path from "path";
import crypto from "crypto";
import { PutObjectCommand } from "@aws-sdk/client-s3";
import type { Express } from "express";
import { getS3Client, getS3Config } from "../config/s3";
import { ApiError } from "./api-error";

const allowedMimeTypes = new Set(["image/jpeg", "image/png", "image/webp"]);
const allowedExtensions = new Set([".jpg", ".jpeg", ".png", ".webp"]);
const mimeTypeToExtensions: Record<string, string[]> = {
  "image/jpeg": [".jpg", ".jpeg"],
  "image/png": [".png"],
  "image/webp": [".webp"],
};

export const MAX_UPLOAD_FILE_SIZE_BYTES = 2 * 1024 * 1024;
export const S3_UPLOAD_FOLDERS = ["vendors", "services", "locations", "venues"] as const;

export type S3UploadFolder = (typeof S3_UPLOAD_FOLDERS)[number];

export function sanitizeFileName(fileName: string): string {
  return fileName
    .normalize("NFKD")
    .replace(/[^a-zA-Z0-9.\-_\s]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .toLowerCase();
}

export function isAllowedImageMimeType(mimeType: string): boolean {
  return allowedMimeTypes.has(mimeType);
}

export function isAllowedImageExtension(extension: string): boolean {
  return allowedExtensions.has(extension.toLowerCase());
}

export function isMimeTypeExtensionCombinationValid(mimeType: string, extension: string): boolean {
  const normalizedExtension = extension.toLowerCase();
  const allowedForMime = mimeTypeToExtensions[mimeType];
  return Array.isArray(allowedForMime) && allowedForMime.includes(normalizedExtension);
}

export function getS3EnvironmentPrefix(nodeEnv: string): "dev" | "prod" {
  return nodeEnv === "production" ? "prod" : "dev";
}

export function parseS3UploadFolder(input: unknown, fallback: S3UploadFolder): S3UploadFolder {
  if (typeof input !== "string") {
    return fallback;
  }

  const normalizedFolder = input.trim().toLowerCase();
  if (
    normalizedFolder === "vendors" ||
    normalizedFolder === "services" ||
    normalizedFolder === "locations" ||
    normalizedFolder === "venues"
  ) {
    return normalizedFolder;
  }

  throw new ApiError(
    400,
    "Invalid upload folder. Allowed folders are: vendors, services, locations, venues",
  );
}

export function buildUniqueFileName(originalName: string): string {
  const extension = path.extname(originalName || "").toLowerCase();
  const baseName = path.basename(originalName || "image", extension);
  const safeBaseName = sanitizeFileName(baseName) || "image";
  const randomSuffix = crypto.randomBytes(8).toString("hex");
  return `${Date.now()}-${randomSuffix}-${safeBaseName}${extension}`;
}

type UploadResult = {
  url: string;
  key: string;
  bucket: string;
};

export async function uploadToS3(file: Express.Multer.File, folder: S3UploadFolder): Promise<UploadResult> {
  const extension = path.extname(file.originalname || "").toLowerCase();

  if (!isAllowedImageMimeType(file.mimetype) || !isAllowedImageExtension(extension)) {
    throw new ApiError(400, "Only jpeg, png, and webp images are allowed");
  }

  if (!isMimeTypeExtensionCombinationValid(file.mimetype, extension)) {
    throw new ApiError(400, "File extension does not match mime type");
  }

  if (file.size > MAX_UPLOAD_FILE_SIZE_BYTES) {
    throw new ApiError(400, "File size must be 2MB or smaller");
  }

  let bucketName: string;
  let region: string;

  try {
    const config = getS3Config();
    bucketName = config.bucketName;
    region = config.region;
  } catch (error) {
    throw new ApiError(500, error instanceof Error ? error.message : "S3 is not configured");
  }

  const environmentPrefix = getS3EnvironmentPrefix(process.env.NODE_ENV ?? "development");
  const fileName = buildUniqueFileName(file.originalname);
  const key = `${environmentPrefix}/${folder}/${fileName}`;

  try {
    const command = new PutObjectCommand({
      Bucket: bucketName,
      Key: key,
      Body: file.buffer,
      ContentType: file.mimetype,
      CacheControl: "public, max-age=31536000, immutable",
    });

    await getS3Client().send(command);

    return {
      url: `https://${bucketName}.s3.${region}.amazonaws.com/${key}`,
      key,
      bucket: bucketName,
    };
  } catch {
    throw new ApiError(500, "Failed to upload file to S3");
  }
}
