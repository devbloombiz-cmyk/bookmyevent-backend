import { galleryRepository } from "../repositories/gallery.repository";
import { ApiError } from "../utils/api-error";

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
      let videoId = "";
      if (host.includes("youtu.be")) {
        videoId = parsed.pathname.replace("/", "").trim();
      } else {
        videoId = parsed.searchParams.get("v") || "";
      }

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
    const galleryItem = await galleryRepository.updateById(galleryId, normalizeGalleryPayload(payload));
    if (!galleryItem) {
      throw new ApiError(404, "Gallery item not found");
    }
    return galleryItem;
  },
  deleteGalleryItem: async (galleryId: string) => {
    const galleryItem = await galleryRepository.deleteById(galleryId);
    if (!galleryItem) {
      throw new ApiError(404, "Gallery item not found");
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
};
