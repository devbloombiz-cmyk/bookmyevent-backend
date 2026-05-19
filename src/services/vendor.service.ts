import crypto from "crypto";
import { vendorRepository } from "../repositories/vendor.repository";
import { userRepository } from "../repositories/user.repository";
import { hashPassword } from "../utils/password";
import { ApiError } from "../utils/api-error";
import { galleryService } from "./gallery.service";
import { locationService } from "./location.service";
import type { UserRole } from "../types/domain";
import type { AuthenticatedUser } from "../types/auth-user";
import { subscriptionService } from "./subscription.service";
import { subscriptionRepository } from "../repositories/subscription.repository";
import { ultramsgWhatsappService } from "./notifications/whatsapp/ultramsg-whatsapp.service";
import { logger } from "../config/logger";

const normalizeText = (value: unknown) => (typeof value === "string" ? value.trim() : "");
const normalizeUrl = (value: unknown) => {
  const url = normalizeText(value);
  if (!url) {
    return "";
  }

  try {
    return new URL(url).toString();
  } catch {
    return "";
  }
};

const textFields = [
  "businessName",
  "ownerName",
  "category",
  "subCategory",
  "state",
  "district",
  "city",
  "locationDisplayName",
  "description",
  "websiteUrl",
  "paymentTerms",
  "travelCost",
  "deliveryTime",
  "coverImage",
  "profileType",
] as const;

const buildNormalizedVendorPayload = (
  payload: Record<string, unknown>,
  options: { partial: boolean },
) => {
  const normalized: Record<string, unknown> = { ...payload };

  for (const field of textFields) {
    if (!options.partial || field in payload) {
      normalized[field] = normalizeText(payload[field]);
    }
  }

  if (!options.partial || "email" in payload) {
    normalized.email = normalizeText(payload.email).toLowerCase();
  }

  if (!options.partial || "mobile" in payload) {
    normalized.mobile = normalizeText(payload.mobile);
  }

  if (!options.partial || "serviceZones" in payload) {
    normalized.serviceZones = Array.isArray(payload.serviceZones)
      ? payload.serviceZones
          .filter((item): item is string => typeof item === "string")
          .map((item) => item.trim())
          .filter(Boolean)
      : [];
  }

  if (!options.partial || "socialLinks" in payload) {
    const links =
      typeof payload.socialLinks === "object" && payload.socialLinks !== null
        ? (payload.socialLinks as Record<string, unknown>)
        : {};

    normalized.socialLinks = {
      facebook: normalizeUrl(links.facebook),
      instagram: normalizeUrl(links.instagram),
      youtube: normalizeUrl(links.youtube),
    };
  }

  if (!options.partial || "websiteUrl" in payload) {
    normalized.websiteUrl = normalizeUrl(payload.websiteUrl);
  }

  if (!options.partial || "portfolioImages" in payload) {
    normalized.portfolioImages = Array.isArray(payload.portfolioImages)
      ? payload.portfolioImages
          .filter((item): item is string => typeof item === "string")
          .map((item) => item.trim())
          .filter(Boolean)
      : [];

    const normalizedPortfolioImages = Array.isArray(normalized.portfolioImages)
      ? normalized.portfolioImages.filter(
          (item): item is string => typeof item === "string" && item.trim().length > 0,
        )
      : [];

    if (!normalizeText(normalized.coverImage) && normalizedPortfolioImages.length > 0) {
      normalized.coverImage = normalizedPortfolioImages[0];
    }
  }

  if (!options.partial || "videoLinks" in payload) {
    normalized.videoLinks = Array.isArray(payload.videoLinks)
      ? payload.videoLinks
          .filter((item): item is string => typeof item === "string")
          .map((item) => normalizeUrl(item))
          .filter(Boolean)
      : [];
  }

  const hasLocationDisplayField = "locationDisplayName" in normalized;
  const hasState = "state" in normalized;
  const hasDistrict = "district" in normalized;
  const hasCity = "city" in normalized;
  if ((!hasLocationDisplayField || !normalizeText(normalized.locationDisplayName)) && (hasState || hasDistrict || hasCity)) {
    const parts = [normalized.city, normalized.district, normalized.state].filter(
      (item): item is string => typeof item === "string" && item.length > 0,
    );
    normalized.locationDisplayName = parts.join(", ");
  }

  return normalized;
};

const ensureVendorUserAccount = async (payload: Record<string, unknown>) => {
  const email = normalizeText(payload.email).toLowerCase();
  const mobile = normalizeText(payload.mobile);
  if (!email || !mobile) {
    return null;
  }
  const name = normalizeText(payload.ownerName) || normalizeText(payload.businessName) || "Vendor";

  const [userByMobile, userByEmail] = await Promise.all([
    userRepository.findByMobile(mobile),
    userRepository.findByEmail(email),
  ]);

  if (userByMobile && userByEmail && userByMobile.id !== userByEmail.id) {
    throw new ApiError(
      409,
      "Email and mobile belong to different accounts. Please use a unique email/mobile combination.",
    );
  }

  const existingUser = userByMobile ?? userByEmail;
  if (existingUser) {
    const updatedUser = await userRepository.updateById(existingUser.id, {
      name,
      email,
      mobile,
      role: "vendor",
      isActive: true,
    });

    return updatedUser ?? existingUser;
  }

  const passwordHash = await hashPassword(crypto.randomBytes(18).toString("hex"));
  return userRepository.create({
    name,
    email,
    mobile,
    passwordHash,
    role: "vendor",
  });
};

const syncLocationIfPresent = async (payload: Record<string, unknown>) => {
  const state = normalizeText(payload.state);
  const district = normalizeText(payload.district);
  const city = normalizeText(payload.city);

  if (!state || !district || !city) {
    return;
  }

  await locationService.createLocation({ state, district, city });
};

const syncVendorUserStatus = async (
  vendorRecord: Record<string, unknown>,
  payload: Record<string, unknown>,
) => {
  const email = normalizeText(vendorRecord.email || payload.email).toLowerCase();
  const mobile = normalizeText(vendorRecord.mobile || payload.mobile);
  const linkedUserId =
    typeof vendorRecord.userId === "string"
      ? vendorRecord.userId
      : vendorRecord.userId
        ? String(vendorRecord.userId)
        : "";

  if (!linkedUserId && !email && !mobile) {
    return;
  }

  const user = linkedUserId
    ? await userRepository.findById(linkedUserId)
    : email
      ? await userRepository.findByEmail(email)
      : mobile
        ? await userRepository.findByMobile(mobile)
        : null;

  if (!user) {
    return;
  }

  const approvalStatus = normalizeText(payload.approvalStatus || vendorRecord.approvalStatus);
  const isVendorActive =
    typeof payload.isActive === "boolean"
      ? payload.isActive
      : typeof vendorRecord.isActive === "boolean"
        ? vendorRecord.isActive
        : true;

        const shouldBeActive = isVendorActive && approvalStatus === "active";

  await userRepository.updateById(user.id, {
    isActive: shouldBeActive,
  });
};

const ensureVendorProfileUniqueness = async (options: {
  email?: string;
  mobile?: string;
  excludeVendorId?: string;
}) => {
  const normalizedEmail = normalizeText(options.email).toLowerCase();
  const normalizedMobile = normalizeText(options.mobile);
  const existingVendor = await vendorRepository.findByEmailOrMobile(normalizedEmail, normalizedMobile);

  if (!existingVendor) {
    return;
  }

  if (options.excludeVendorId && String(existingVendor._id) === options.excludeVendorId) {
    return;
  }

  throw new ApiError(409, "Vendor already exists for this email or mobile");
};

const notifyVendorApprovalActivated = async (vendorRecord: Record<string, unknown>) => {
  const mobile = normalizeText(vendorRecord.mobile);
  if (!mobile || !ultramsgWhatsappService.isEnabled()) {
    return;
  }

  const businessName = normalizeText(vendorRecord.businessName) || "your vendor profile";
  const message = `BookMyEvent update: ${businessName} is approved. You can now login at /login and continue onboarding.`;

  try {
    await ultramsgWhatsappService.sendMessage({
      to: mobile,
      body: message,
      context: "vendor_approval",
    });
  } catch (error) {
    logger.warn(
      {
        vendorId: String(vendorRecord._id || ""),
        mobile,
        error,
      },
      "Unable to send vendor approval WhatsApp notification",
    );
  }
};

const hasActiveProSubscription = async (vendorId: string) => {
  const activeProRows = await subscriptionRepository.findActiveProByActorIds("vendor", [vendorId]);
  return activeProRows.length > 0;
};

const toDistrictOnlyServiceZones = (district: unknown) => {
  const normalizedDistrict = normalizeText(district);
  return normalizedDistrict ? [normalizedDistrict] : [];
};

const enforceVendorServiceZonePolicy = (
  normalizedPayload: Record<string, unknown>,
  options: { allowMultiple: boolean; fallbackDistrict?: unknown },
) => {
  if (options.allowMultiple) {
    return;
  }

  const districtSource = "district" in normalizedPayload
    ? normalizedPayload.district
    : options.fallbackDistrict;

  normalizedPayload.serviceZones = toDistrictOnlyServiceZones(districtSource);
};

export const vendorService = {
  createVendor: async (
    payload: Record<string, unknown>,
    options?: { requestedByRole?: UserRole },
  ) => {
    const normalizedPayload = buildNormalizedVendorPayload(payload, { partial: false });
    normalizedPayload.profileType = "vendor";

    // New vendors are always onboarded before subscription. Persist only cover image at this stage.
    normalizedPayload.portfolioImages = [];
    normalizedPayload.videoLinks = [];
    enforceVendorServiceZonePolicy(normalizedPayload, {
      allowMultiple: false,
      fallbackDistrict: normalizedPayload.district,
    });

    const privilegedCreatorRoles: UserRole[] = ["super_admin", "vendor_admin", "accounts_admin"];
    const isPrivilegedCreator = options?.requestedByRole
      ? privilegedCreatorRoles.includes(options.requestedByRole)
      : false;

    if (!isPrivilegedCreator) {
      normalizedPayload.approvalStatus = "pending";
      normalizedPayload.isVerified = false;
      if (!("isActive" in normalizedPayload)) {
        normalizedPayload.isActive = true;
      }
    }

    await ensureVendorProfileUniqueness({
      email: String(normalizedPayload.email || ""),
      mobile: String(normalizedPayload.mobile || ""),
    });

    const [linkedUser] = await Promise.all([
      ensureVendorUserAccount(normalizedPayload),
      syncLocationIfPresent(normalizedPayload),
    ]);

    if (linkedUser?._id) {
      normalizedPayload.userId = linkedUser._id;
    }

    const vendor = await vendorRepository.create(normalizedPayload);
    await syncVendorUserStatus(vendor.toObject(), normalizedPayload);

    const portfolioImages = Array.isArray(normalizedPayload.portfolioImages)
      ? normalizedPayload.portfolioImages.filter((item): item is string => typeof item === "string" && item.trim().length > 0)
      : [];

    await galleryService.syncVendorPortfolioGalleryItems({
      vendorId: String(vendor._id),
      vendorName: String(vendor.businessName ?? "Vendor"),
      category: String(vendor.category ?? "general"),
      subCategory: String(vendor.subCategory ?? ""),
      city: String(vendor.city ?? ""),
      mediaUrls: portfolioImages,
    });

    return vendor;
  },
  listVendors: async (filters: Record<string, unknown>) => {
    const vendors = await vendorRepository.findAll(filters);
    const vendorIds = vendors.map((item) => String(item._id));
    const activeProRows = await subscriptionRepository.findActiveProByActorIds("vendor", vendorIds);
    const activeProIdSet = new Set(activeProRows.map((item) => String(item.actorId)));

    return vendors.map((vendor) => {
      const row = vendor.toObject() as Record<string, unknown>;
      const isSubscribedPro = activeProIdSet.has(String(vendor._id));
      const isVerified = Boolean(row.isVerified) || isSubscribedPro;
      return {
        ...row,
        isSubscribedPro,
        isVerified,
      };
    });
  },
  getVendorById: async (vendorId: string, includeInactive = false) => {
    const vendor = await vendorRepository.findById(vendorId);
    if (!vendor) {
      throw new ApiError(404, "Vendor not found");
    }

    if (vendor.profileType === "venue_owner_shadow") {
      throw new ApiError(404, "Vendor not found");
    }

    if (!includeInactive && (!vendor.isActive || vendor.approvalStatus !== "active")) {
      throw new ApiError(404, "Vendor not found");
    }

    const activeProRows = await subscriptionRepository.findActiveProByActorIds("vendor", [vendorId]);
    const isSubscribedPro = activeProRows.length > 0;
    const row = vendor.toObject() as Record<string, unknown>;

    return {
      ...row,
      isSubscribedPro,
      isVerified: Boolean(row.isVerified) || isSubscribedPro,
    };
  },
  getMyVendorProfile: async (authUser: Pick<AuthenticatedUser, "id">) => {
    const vendorByUserId = await vendorRepository.findByUserId(authUser.id);
    if (vendorByUserId) {
      return vendorByUserId;
    }

    const user = await userRepository.findById(authUser.id);
    if (!user) {
      throw new ApiError(404, "User not found");
    }

    const vendor = await vendorRepository.findByEmailOrMobile(user.email, user.mobile);
    if (!vendor) {
      throw new ApiError(404, "Vendor profile not found");
    }

    if (!vendor.userId) {
      await vendorRepository.updateById(String(vendor._id), {
        userId: authUser.id,
      });
    }

    return vendor;
  },
  updateMyVendorProfile: async (
    authUser: Pick<AuthenticatedUser, "id">,
    payload: Record<string, unknown>,
  ) => {
    const vendorByUserId = await vendorRepository.findByUserId(authUser.id);
    if (vendorByUserId) {
      const normalizedPayload = buildNormalizedVendorPayload(payload, { partial: true });
      await ensureVendorProfileUniqueness({
        email: String(normalizedPayload.email ?? vendorByUserId.email ?? ""),
        mobile: String(normalizedPayload.mobile ?? vendorByUserId.mobile ?? ""),
        excludeVendorId: String(vendorByUserId._id),
      });
      const isSubscribedPro = await hasActiveProSubscription(String(vendorByUserId._id));

      enforceVendorServiceZonePolicy(normalizedPayload, {
        allowMultiple: isSubscribedPro,
        fallbackDistrict:
          "district" in normalizedPayload
            ? normalizedPayload.district
            : vendorByUserId.district,
      });

      if (Array.isArray(normalizedPayload.portfolioImages)) {
        await subscriptionService.assertWithinLimit(
          { id: authUser.id, role: "vendor" },
          "maxPortfolioImages",
          normalizedPayload.portfolioImages.length,
        );
      }

      if (Array.isArray(normalizedPayload.videoLinks)) {
        await subscriptionService.assertWithinLimit(
          { id: authUser.id, role: "vendor" },
          "maxVideoLinks",
          normalizedPayload.videoLinks.length,
        );
      }

      await syncLocationIfPresent(normalizedPayload);

      const updatedVendor = await vendorRepository.updateById(String(vendorByUserId._id), normalizedPayload);
      if (!updatedVendor) {
        throw new ApiError(404, "Vendor not found");
      }

      if (Array.isArray(normalizedPayload.portfolioImages)) {
        await galleryService.syncVendorPortfolioGalleryItems({
          vendorId: String(updatedVendor._id),
          vendorName: String(updatedVendor.businessName ?? "Vendor"),
          category: String(updatedVendor.category ?? "general"),
          subCategory: String(updatedVendor.subCategory ?? ""),
          city: String(updatedVendor.city ?? ""),
          mediaUrls: normalizedPayload.portfolioImages.filter(
            (item): item is string => typeof item === "string" && item.trim().length > 0,
          ),
        });
      }

      return updatedVendor;
    }

    const user = await userRepository.findById(authUser.id);
    if (!user) {
      throw new ApiError(404, "User not found");
    }

    const vendor = await vendorRepository.findByEmailOrMobile(user.email, user.mobile);
    if (!vendor) {
      throw new ApiError(404, "Vendor profile not found");
    }

    if (!vendor.userId) {
      await vendorRepository.updateById(String(vendor._id), {
        userId: authUser.id,
      });
    }

    const normalizedPayload = buildNormalizedVendorPayload(payload, { partial: true });
    await ensureVendorProfileUniqueness({
      email: String(normalizedPayload.email ?? vendor.email ?? ""),
      mobile: String(normalizedPayload.mobile ?? vendor.mobile ?? ""),
      excludeVendorId: String(vendor._id),
    });
    const isSubscribedPro = await hasActiveProSubscription(String(vendor._id));

    enforceVendorServiceZonePolicy(normalizedPayload, {
      allowMultiple: isSubscribedPro,
      fallbackDistrict: "district" in normalizedPayload ? normalizedPayload.district : vendor.district,
    });

    if (Array.isArray(normalizedPayload.portfolioImages)) {
      await subscriptionService.assertWithinLimit(
        { id: authUser.id, role: "vendor" },
        "maxPortfolioImages",
        normalizedPayload.portfolioImages.length,
      );
    }

    if (Array.isArray(normalizedPayload.videoLinks)) {
      await subscriptionService.assertWithinLimit(
        { id: authUser.id, role: "vendor" },
        "maxVideoLinks",
        normalizedPayload.videoLinks.length,
      );
    }

    await syncLocationIfPresent(normalizedPayload);

    const updatedVendor = await vendorRepository.updateById(String(vendor._id), normalizedPayload);
    if (!updatedVendor) {
      throw new ApiError(404, "Vendor not found");
    }

    if (Array.isArray(normalizedPayload.portfolioImages)) {
      await galleryService.syncVendorPortfolioGalleryItems({
        vendorId: String(updatedVendor._id),
        vendorName: String(updatedVendor.businessName ?? "Vendor"),
        category: String(updatedVendor.category ?? "general"),
        subCategory: String(updatedVendor.subCategory ?? ""),
        city: String(updatedVendor.city ?? ""),
        mediaUrls: normalizedPayload.portfolioImages.filter(
          (item): item is string => typeof item === "string" && item.trim().length > 0,
        ),
      });
    }

    return updatedVendor;
  },
  updateVendor: async (vendorId: string, payload: Record<string, unknown>) => {
    const normalizedPayload = buildNormalizedVendorPayload(payload, { partial: true });
    normalizedPayload.profileType = "vendor";

    const existingVendor = await vendorRepository.findById(vendorId);
    if (!existingVendor) {
      throw new ApiError(404, "Vendor not found");
    }

    const previousApprovalStatus = normalizeText(existingVendor.approvalStatus);

    await ensureVendorProfileUniqueness({
      email: String(normalizedPayload.email ?? existingVendor.email ?? ""),
      mobile: String(normalizedPayload.mobile ?? existingVendor.mobile ?? ""),
      excludeVendorId: vendorId,
    });

    const [linkedUser] = await Promise.all([
      ensureVendorUserAccount(normalizedPayload),
      syncLocationIfPresent(normalizedPayload),
    ]);

    if (linkedUser?._id) {
      normalizedPayload.userId = linkedUser._id;
    }

    const allowExtendedMedia = await hasActiveProSubscription(vendorId);
    enforceVendorServiceZonePolicy(normalizedPayload, {
      allowMultiple: allowExtendedMedia,
      fallbackDistrict:
        "district" in normalizedPayload ? normalizedPayload.district : existingVendor.district,
    });

    if (!allowExtendedMedia) {
      if ("portfolioImages" in normalizedPayload) {
        normalizedPayload.portfolioImages = [];
      }
      if ("videoLinks" in normalizedPayload) {
        normalizedPayload.videoLinks = [];
      }
    }

    const persistedVendor = await vendorRepository.updateById(vendorId, normalizedPayload);
    if (!persistedVendor) {
      throw new ApiError(404, "Vendor not found");
    }

    if (Array.isArray(normalizedPayload.portfolioImages) && normalizedPayload.portfolioImages.length > 0) {
      await galleryService.syncVendorPortfolioGalleryItems({
        vendorId: String(persistedVendor._id),
        vendorName: String(persistedVendor.businessName ?? "Vendor"),
        category: String(persistedVendor.category ?? "general"),
        subCategory: String(persistedVendor.subCategory ?? ""),
        city: String(persistedVendor.city ?? ""),
        mediaUrls: normalizedPayload.portfolioImages.filter(
          (item): item is string => typeof item === "string" && item.trim().length > 0,
        ),
      });
    } else if ("portfolioImages" in normalizedPayload) {
      await galleryService.syncVendorPortfolioGalleryItems({
        vendorId: String(persistedVendor._id),
        vendorName: String(persistedVendor.businessName ?? "Vendor"),
        category: String(persistedVendor.category ?? "general"),
        subCategory: String(persistedVendor.subCategory ?? ""),
        city: String(persistedVendor.city ?? ""),
        mediaUrls: [],
      });
    }

    await syncVendorUserStatus(existingVendor.toObject(), normalizedPayload);

    const nextApprovalStatus = normalizeText(persistedVendor.approvalStatus);
    if (previousApprovalStatus === "pending" && nextApprovalStatus === "active") {
      await notifyVendorApprovalActivated(persistedVendor.toObject());
    }

    return persistedVendor;
  },
  deleteVendor: async (vendorId: string) => {
    const vendor = await vendorRepository.deleteById(vendorId);
    if (!vendor) {
      throw new ApiError(404, "Vendor not found");
    }
    return vendor;
  },
};
