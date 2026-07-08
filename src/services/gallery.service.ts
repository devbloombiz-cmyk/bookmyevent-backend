import { galleryRepository } from "../repositories/gallery.repository";
import { ApiError } from "../utils/api-error";
import { deleteManyFromS3 } from "../utils/s3";
import { logger } from "../config/logger";

const normalizeUrl = (value: unknown) => {
  const raw = typeof value === "string" ? value.trim() : "";
  if (!raw) {
    return "";
  }

  try {
    return new URL(raw).toString();
  } catch {
    return "";
  }
};

const buildVideoMeta = (mediaUrl: string) => {
  if (!mediaUrl) {
    return { videoPlatform: "other", embedUrl: "" } as const;
  }

  try {
    const parsed = new URL(mediaUrl);
    const host = parsed.hostname.toLowerCase();

    if (host.includes("youtube.com") || host.includes("youtu.be")) {
      const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|shorts\/|watch\?v=|\&v=)([^#\&\?]*).*/;
      const match = mediaUrl.match(regExp);
      const videoId = (match && match[2].length === 11) ? match[2] : "";

      if (videoId) {
        return {
          videoPlatform: "youtube",
          embedUrl: `https://www.youtube.com/embed/${videoId}?rel=0&modestbranding=1`,
        } as const;
      }
    }

    if (host.includes("instagram.com")) {
      const cleanedPath = parsed.pathname.replace(/\/$/, "");
      if (cleanedPath.includes("/reel/") || cleanedPath.includes("/p/")) {
        return {
          videoPlatform: "instagram",
          embedUrl: `${parsed.origin}${cleanedPath}/embed`,
        } as const;
      }
    }
  } catch {
    return { videoPlatform: "other", embedUrl: "" } as const;
  }

  return { videoPlatform: "other", embedUrl: "" } as const;
};

const normalizeGalleryPayload = (payload: Record<string, unknown>) => {
  const normalized: Record<string, unknown> = { ...payload };

  if ("mediaUrl" in payload) {
    normalized.mediaUrl = normalizeUrl(payload.mediaUrl);
  }

  if ("thumbnailUrl" in payload) {
    normalized.thumbnailUrl = normalizeUrl(payload.thumbnailUrl);
  }

  const shouldRecomputeVideoMeta = "mediaType" in payload || "mediaUrl" in payload;
  if (shouldRecomputeVideoMeta) {
    const mediaType = typeof payload.mediaType === "string" ? payload.mediaType : "";
    const mediaUrl = typeof normalized.mediaUrl === "string" ? normalized.mediaUrl : "";

    if (mediaType === "video") {
      const meta = buildVideoMeta(mediaUrl);
      normalized.videoPlatform = meta.videoPlatform;
      normalized.embedUrl = meta.embedUrl;
    } else {
      normalized.videoPlatform = "other";
      normalized.embedUrl = "";
    }
  }

  return normalized;
};

export const galleryService = {
  createGalleryItem: (payload: Record<string, unknown>) =>
    galleryRepository.create(normalizeGalleryPayload(payload)),
  listGalleryItems: (filters: Record<string, unknown>) => galleryRepository.list(filters),
  updateGalleryItem: async (galleryId: string, payload: Record<string, unknown>) => {
    const existing = await galleryRepository.findById(galleryId);
    if (!existing) {
      throw new ApiError(404, "Gallery item not found");
    }

    const normalized = normalizeGalleryPayload(payload);
    const galleryItem = await galleryRepository.updateById(galleryId, normalized);
    if (!galleryItem) {
      throw new ApiError(404, "Gallery item not found");
    }

    const deletedUrls: string[] = [];
    if ("mediaUrl" in normalized) {
      const oldUrl = String(existing.mediaUrl || "").trim();
      const newUrl = String(normalized.mediaUrl || "").trim();
      if (oldUrl && oldUrl !== newUrl) {
        deletedUrls.push(oldUrl);
      }
    }
    if ("thumbnailUrl" in normalized) {
      const oldThumb = String(existing.thumbnailUrl || "").trim();
      const newThumb = String(normalized.thumbnailUrl || "").trim();
      if (oldThumb && oldThumb !== newThumb) {
        deletedUrls.push(oldThumb);
      }
    }

    if (deletedUrls.length > 0) {
      deleteManyFromS3(deletedUrls).catch((err) => {
        logger.error({ err, deletedUrls }, "Error in updateGalleryItem S3 cleanup");
      });
    }

    return galleryItem;
  },
  deleteGalleryItem: async (galleryId: string) => {
    const galleryItem = await galleryRepository.deleteById(galleryId);
    if (!galleryItem) {
      throw new ApiError(404, "Gallery item not found");
    }

    const urlsToDelete: string[] = [];
    if (galleryItem.mediaUrl) {
      urlsToDelete.push(String(galleryItem.mediaUrl));
    }
    if (galleryItem.thumbnailUrl) {
      urlsToDelete.push(String(galleryItem.thumbnailUrl));
    }

    if (urlsToDelete.length > 0) {
      deleteManyFromS3(urlsToDelete).catch((err) => {
        logger.error({ err, urlsToDelete }, "Error deleting gallery item images from S3");
      });
    }

    return galleryItem;
  },
  createVendorPortfolioGalleryItems: async (payload: {
    vendorId: string;
    vendorName: string;
    category: string;
    subCategory: string;
    city: string;
    mediaUrls: string[];
  }) => {
    const galleryRows = payload.mediaUrls.map((mediaUrl) => ({
      title: `${payload.vendorName} portfolio`,
      category: payload.category,
      subCategory: payload.subCategory,
      mediaType: "image",
      mediaUrl,
      sourceType: "vendor",
      vendorId: payload.vendorId,
      location: payload.city,
      isFeatured: false,
      isActive: true,
    }));

    if (!galleryRows.length) {
      return [];
    }

    return galleryRepository.createMany(galleryRows);
  },
  syncVendorPortfolioGalleryItems: async (payload: {
    vendorId: string;
    vendorName: string;
    category: string;
    subCategory: string;
    city: string;
    mediaUrls: string[];
  }) => {
    await galleryRepository.deleteManyByVendorAndMediaType(payload.vendorId, "image");

    if (!payload.mediaUrls.length) {
      return [];
    }

    return galleryService.createVendorPortfolioGalleryItems(payload);
  },
  createVendorVideoGalleryItems: async (payload: {
    vendorId: string;
    vendorName: string;
    category: string;
    subCategory: string;
    city: string;
    videoUrls: string[];
  }) => {
    const galleryRows = payload.videoUrls.map((videoUrl) => {
      const meta = buildVideoMeta(videoUrl);
      return {
        title: `${payload.vendorName} video`,
        category: payload.category,
        subCategory: payload.subCategory,
        mediaType: "video" as const,
        mediaUrl: videoUrl,
        sourceType: "vendor" as const,
        vendorId: payload.vendorId,
        location: payload.city,
        isFeatured: false,
        isActive: true,
        videoPlatform: meta.videoPlatform,
        embedUrl: meta.embedUrl,
      };
    });

    if (!galleryRows.length) {
      return [];
    }

    return galleryRepository.createMany(galleryRows);
  },
  syncVendorVideoGalleryItems: async (payload: {
    vendorId: string;
    vendorName: string;
    category: string;
    subCategory: string;
    city: string;
    videoUrls: string[];
  }) => {
    await galleryRepository.deleteManyByVendorAndMediaType(payload.vendorId, "video");

    if (!payload.videoUrls.length) {
      return [];
    }

    return galleryService.createVendorVideoGalleryItems(payload);
  },
};
