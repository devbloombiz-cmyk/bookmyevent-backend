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
const normalizeSubCategories = (value: unknown) => {
  if (!Array.isArray(value)) {
    return [] as string[];
  }

  const unique = new Set<string>();
  for (const item of value) {
    const normalized = normalizeText(item);
    if (normalized) {
      unique.add(normalized);
    }
  }

  return Array.from(unique);
};
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

const normalizeBookingAgainst = (value: unknown): "vendor" | "package" =>
  normalizeText(value).toLowerCase() === "vendor" ? "vendor" : "package";

const buildNormalizedVendorPayload = (
  payload: Record<string, unknown>,
  options: { partial: boolean },
) => {
  const normalized: Record<string, unknown> = { ...payload };

  // referralCode is system-managed and assigned only after eligible subscription activation.
  delete normalized.referralCode;
  delete normalized.referralCodeAssignedAt;

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

  if (!options.partial) {
    normalized.bookingAgainst = "package";
  }

  if ("bookingAgainst" in payload) {
    normalized.bookingAgainst = normalizeBookingAgainst(payload.bookingAgainst);
  }

  if (!options.partial || "serviceZones" in payload) {
    normalized.serviceZones = Array.isArray(payload.serviceZones)
      ? payload.serviceZones
          .filter((item): item is string => typeof item === "string")
          .map((item) => item.trim())
          .filter(Boolean)
      : [];
  }

  const shouldNormalizeSubCategories =
    !options.partial || "subCategory" in payload || "subCategories" in payload;
  if (shouldNormalizeSubCategories) {
    const normalizedSubCategories = normalizeSubCategories(payload.subCategories);
    const normalizedSubCategory = normalizeText(payload.subCategory);
    const derivedSubCategories = normalizedSubCategories.length
      ? normalizedSubCategories
      : normalizedSubCategory
        ? [normalizedSubCategory]
        : [];

    normalized.subCategories = derivedSubCategories;
    normalized.subCategory = derivedSubCategories[0] || "";
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
  if (
    (!hasLocationDisplayField || !normalizeText(normalized.locationDisplayName)) &&
    (hasState || hasDistrict || hasCity)
  ) {
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

const syncUserAccount = async (
  userId: string | undefined | null,
  normalizedPayload: Record<string, unknown>,
  existingVendor: Record<string, unknown>,
) => {
  const linkedUserId = userId ? String(userId) : "";
  if (!linkedUserId) {
    return;
  }

  const user = await userRepository.findById(linkedUserId);
  if (!user) {
    return;
  }

  const updatePayload: Record<string, unknown> = {};

  if ("ownerName" in normalizedPayload || "businessName" in normalizedPayload) {
    const ownerName = normalizeText(normalizedPayload.ownerName ?? existingVendor.ownerName);
    const businessName = normalizeText(
      normalizedPayload.businessName ?? existingVendor.businessName,
    );
    updatePayload.name = ownerName || businessName || "Vendor";
  }

  if ("email" in normalizedPayload) {
    const email = normalizeText(normalizedPayload.email).toLowerCase();
    if (email && email !== user.email) {
      const emailOwner = await userRepository.findByEmail(email);
      if (emailOwner && emailOwner.id !== user.id) {
        throw new ApiError(409, "Email already registered to another account");
      }
      updatePayload.email = email;
    }
  }

  if ("mobile" in normalizedPayload) {
    const mobile = normalizeText(normalizedPayload.mobile);
    if (mobile && mobile !== user.mobile) {
      const mobileOwner = await userRepository.findByMobile(mobile);
      if (mobileOwner && mobileOwner.id !== user.id) {
        throw new ApiError(409, "Mobile number already registered to another account");
      }
      updatePayload.mobile = mobile;
    }
  }

  if (Object.keys(updatePayload).length > 0) {
    await userRepository.updateById(user.id, updatePayload);
  }
};

const withBackwardCompatibleSubCategories = (
  vendor: Record<string, unknown>,
): Record<string, unknown> & { subCategory: string; subCategories: string[] } => {
  const existingSubCategories = normalizeSubCategories(vendor.subCategories);
  const legacySubCategory = normalizeText(vendor.subCategory);
  const subCategories = existingSubCategories.length
    ? existingSubCategories
    : legacySubCategory
      ? [legacySubCategory]
      : [];

  return {
    ...vendor,
    subCategory: legacySubCategory || subCategories[0] || "",
    subCategories,
  } as Record<string, unknown> & { subCategory: string; subCategories: string[] };
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
  const existingVendor = await vendorRepository.findByEmailOrMobile(
    normalizedEmail,
    normalizedMobile,
  );

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
  const message = `BookMyEvent update: ${businessName} is approved. You can now login at www.bookmyevent.ae/login and continue onboarding.`;

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

const toSingleSubCategory = (payload: {
  subCategories?: unknown;
  subCategory?: unknown;
  fallbackSubCategories?: unknown;
  fallbackSubCategory?: unknown;
}) => {
  const directSubCategories = normalizeSubCategories(payload.subCategories);
  const fallbackSubCategories = normalizeSubCategories(payload.fallbackSubCategories);
  const directSubCategory = normalizeText(payload.subCategory);
  const fallbackSubCategory = normalizeText(payload.fallbackSubCategory);

  const source =
    directSubCategories.length > 0
      ? directSubCategories
      : fallbackSubCategories.length > 0
        ? fallbackSubCategories
        : directSubCategory
          ? [directSubCategory]
          : fallbackSubCategory
            ? [fallbackSubCategory]
            : [];

  const first = source[0] || "";
  return {
    subCategory: first,
    subCategories: first ? [first] : [],
  };
};

const enforceVendorServiceZonePolicy = (
  normalizedPayload: Record<string, unknown>,
  options: { allowMultiple: boolean; fallbackDistrict?: unknown },
) => {
  if (options.allowMultiple) {
    return;
  }

  const districtSource =
    "district" in normalizedPayload ? normalizedPayload.district : options.fallbackDistrict;

  normalizedPayload.serviceZones = toDistrictOnlyServiceZones(districtSource);
};

const enforceVendorSubCategoryPolicy = (
  normalizedPayload: Record<string, unknown>,
  options: {
    allowMultiple: boolean;
    partial?: boolean;
    fallbackSubCategories?: unknown;
    fallbackSubCategory?: unknown;
  },
) => {
  if (options.allowMultiple) {
    return;
  }

  const shouldApply =
    !options.partial || "subCategory" in normalizedPayload || "subCategories" in normalizedPayload;
  if (!shouldApply) {
    return;
  }

  const normalized = toSingleSubCategory({
    subCategory: normalizedPayload.subCategory,
    subCategories: normalizedPayload.subCategories,
    fallbackSubCategory: options.fallbackSubCategory,
    fallbackSubCategories: options.fallbackSubCategories,
  });

  normalizedPayload.subCategory = normalized.subCategory;
  normalizedPayload.subCategories = normalized.subCategories;
};

const resolveReferralAttribution = async (options: {
  code?: unknown;
  email?: unknown;
  mobile?: unknown;
}) => {
  const rawCode = normalizeText(options.code).toUpperCase();
  if (!rawCode) {
    return {
      referredByVendorId: null,
      referredByReferralCode: "",
      referralAttributedAt: null,
    };
  }

  const referrer = await vendorRepository.findByReferralCode(rawCode);
  if (!referrer || !referrer.isActive || normalizeText(referrer.approvalStatus) !== "active") {
    throw new ApiError(400, "Invalid referral code");
  }

  const normalizedEmail = normalizeText(options.email).toLowerCase();
  const normalizedMobile = normalizeText(options.mobile);
  const isSelfReferral =
    (!!normalizedEmail && normalizedEmail === normalizeText(referrer.email).toLowerCase()) ||
    (!!normalizedMobile && normalizedMobile === normalizeText(referrer.mobile));

  if (isSelfReferral) {
    throw new ApiError(400, "Self referral is not allowed");
  }

  return {
    referredByVendorId: String(referrer._id),
    referredByReferralCode: String(referrer.referralCode || rawCode),
    referralAttributedAt: new Date(),
  };
};

const mapReferredVendor = (vendor: Record<string, unknown>) => ({
  _id: String(vendor._id || ""),
  businessName: String(vendor.businessName || ""),
  ownerName: String(vendor.ownerName || ""),
  email: String(vendor.email || ""),
  mobile: String(vendor.mobile || ""),
  category: String(vendor.category || ""),
  subCategory: String(vendor.subCategory || ""),
  district: String(vendor.district || ""),
  city: String(vendor.city || ""),
  approvalStatus: String(vendor.approvalStatus || "pending"),
  isActive: Boolean(vendor.isActive),
  referredByVendorId: vendor.referredByVendorId ? String(vendor.referredByVendorId) : "",
  referredByReferralCode: String(vendor.referredByReferralCode || ""),
  createdAt: String(vendor.createdAt || ""),
});

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
    enforceVendorSubCategoryPolicy(normalizedPayload, {
      allowMultiple: false,
    });

    const referralAttribution = await resolveReferralAttribution({
      code: normalizedPayload.referredByReferralCode,
      email: normalizedPayload.email,
      mobile: normalizedPayload.mobile,
    });
    normalizedPayload.referredByVendorId = referralAttribution.referredByVendorId;
    normalizedPayload.referredByReferralCode = referralAttribution.referredByReferralCode;
    normalizedPayload.referralAttributedAt = referralAttribution.referralAttributedAt;

    const privilegedCreatorRoles: UserRole[] = ["super_admin", "vendor_admin", "accounts_admin"];
    const isPrivilegedCreator = options?.requestedByRole
      ? privilegedCreatorRoles.includes(options.requestedByRole)
      : false;

    normalizedPayload.registrationSource = isPrivilegedCreator ? "admin" : "public";

    if (isPrivilegedCreator) {
      normalizedPayload.approvalStatus = "active";
      normalizedPayload.isActive = true;
    }

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

    await syncLocationIfPresent(normalizedPayload);

    const vendor = await vendorRepository.create(normalizedPayload);
    const linkedUser = await (async () => {
      try {
        return await ensureVendorUserAccount(normalizedPayload);
      } catch (error) {
        try {
          await vendorRepository.deleteById(String(vendor._id));
        } catch (rollbackError) {
          logger.error(
            {
              vendorId: String(vendor._id),
              rollbackError,
            },
            "Failed to rollback vendor record after user-link failure",
          );
        }
        throw error;
      }
    })();

    let persistedVendor = vendor;
    if (linkedUser?._id) {
      const updatedVendor = await vendorRepository.updateById(String(vendor._id), {
        userId: linkedUser._id,
      });
      if (!updatedVendor) {
        await vendorRepository.deleteById(String(vendor._id));
        throw new ApiError(500, "Unable to link vendor account. Please try again.");
      }
      normalizedPayload.userId = linkedUser._id;
      persistedVendor = updatedVendor;
    }

    await syncVendorUserStatus(persistedVendor.toObject(), normalizedPayload);

    const portfolioImages = Array.isArray(normalizedPayload.portfolioImages)
      ? normalizedPayload.portfolioImages.filter(
          (item): item is string => typeof item === "string" && item.trim().length > 0,
        )
      : [];

    await galleryService.syncVendorPortfolioGalleryItems({
      vendorId: String(persistedVendor._id),
      vendorName: String(persistedVendor.businessName ?? "Vendor"),
      category: String(persistedVendor.category ?? "general"),
      subCategory: String(persistedVendor.subCategory ?? ""),
      city: String(persistedVendor.city ?? ""),
      mediaUrls: portfolioImages,
    });

    return persistedVendor;
  },
  listVendors: async (filters: Record<string, unknown>) => {
    const vendors = await vendorRepository.findAll(filters);
    const vendorIds = vendors.map((item) => String(item._id));
    const activeProRows = await subscriptionRepository.findActiveProByActorIds("vendor", vendorIds);
    const activeProIdSet = new Set(activeProRows.map((item) => String(item.actorId)));

    return vendors.map((vendor) => {
      const row = withBackwardCompatibleSubCategories(vendor.toObject() as Record<string, unknown>);
      const isSubscribedPro = activeProIdSet.has(String(vendor._id));
      const isVerified = Boolean(row.isVerified) || isSubscribedPro;
      return {
        ...row,
        isSubscribedPro,
        isVerified,
      };
    });
  },
  validateReferralCode: async (code: string) => {
    const normalizedCode = normalizeText(code).toUpperCase();
    if (!normalizedCode) {
      return { valid: false, vendor: null };
    }

    const vendor = await vendorRepository.findByReferralCode(normalizedCode);
    if (!vendor || !vendor.isActive || normalizeText(vendor.approvalStatus) !== "active") {
      return { valid: false, vendor: null };
    }

    return {
      valid: true,
      vendor: {
        _id: String(vendor._id),
        businessName: String(vendor.businessName || ""),
        referralCode: String(vendor.referralCode || normalizedCode),
      },
    };
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

    const activeProRows = await subscriptionRepository.findActiveProByActorIds("vendor", [
      vendorId,
    ]);
    const isSubscribedPro = activeProRows.length > 0;
    const row = withBackwardCompatibleSubCategories(vendor.toObject() as Record<string, unknown>);

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
          "district" in normalizedPayload ? normalizedPayload.district : vendorByUserId.district,
      });
      enforceVendorSubCategoryPolicy(normalizedPayload, {
        allowMultiple: isSubscribedPro,
        partial: true,
        fallbackSubCategory: vendorByUserId.subCategory,
        fallbackSubCategories: vendorByUserId.subCategories,
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

      await syncUserAccount(
        String(vendorByUserId.userId || authUser.id),
        normalizedPayload,
        vendorByUserId.toObject(),
      );

      const updatedVendor = await vendorRepository.updateById(
        String(vendorByUserId._id),
        normalizedPayload,
      );
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
      fallbackDistrict:
        "district" in normalizedPayload ? normalizedPayload.district : vendor.district,
    });
    enforceVendorSubCategoryPolicy(normalizedPayload, {
      allowMultiple: isSubscribedPro,
      partial: true,
      fallbackSubCategory: vendor.subCategory,
      fallbackSubCategories: vendor.subCategories,
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

    await syncUserAccount(
      String(vendor.userId || authUser.id),
      normalizedPayload,
      vendor.toObject(),
    );

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

    const linkedUserId = existingVendor.userId;
    if (linkedUserId) {
      await syncUserAccount(String(linkedUserId), normalizedPayload, existingVendor.toObject());
    } else {
      const linkedUser = await ensureVendorUserAccount({
        email: normalizedPayload.email ?? existingVendor.email,
        mobile: normalizedPayload.mobile ?? existingVendor.mobile,
        ownerName: normalizedPayload.ownerName ?? existingVendor.ownerName,
        businessName: normalizedPayload.businessName ?? existingVendor.businessName,
      });
      if (linkedUser?._id) {
        normalizedPayload.userId = linkedUser._id;
      }
    }
    await syncLocationIfPresent(normalizedPayload);

    const allowExtendedMedia = await hasActiveProSubscription(vendorId);
    enforceVendorServiceZonePolicy(normalizedPayload, {
      allowMultiple: allowExtendedMedia,
      fallbackDistrict:
        "district" in normalizedPayload ? normalizedPayload.district : existingVendor.district,
    });
    enforceVendorSubCategoryPolicy(normalizedPayload, {
      allowMultiple: allowExtendedMedia,
      partial: true,
      fallbackSubCategory: existingVendor.subCategory,
      fallbackSubCategories: existingVendor.subCategories,
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

    if (
      Array.isArray(normalizedPayload.portfolioImages) &&
      normalizedPayload.portfolioImages.length > 0
    ) {
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

    if (vendor.userId) {
      await userRepository.deleteById(String(vendor.userId));
    }

    return vendor;
  },
  listMyReferredVendors: async (authUser: Pick<AuthenticatedUser, "id">, limit = 200) => {
    const vendor = await vendorService.getMyVendorProfile(authUser);
    const referrals = await vendorRepository.findByReferredByVendorId(String(vendor._id), limit);
    const rows = referrals.map((item) =>
      mapReferredVendor(item.toObject() as Record<string, unknown>),
    );

    return {
      summary: {
        totalReferredVendors: rows.length,
        activeReferredVendors: rows.filter((item) => item.isActive).length,
        pendingReferredVendors: rows.filter((item) => item.approvalStatus === "pending").length,
      },
      referralCode: String(vendor.referralCode || ""),
      vendors: rows,
    };
  },
  listAdminReferralVendors: async (limit = 500) => {
    const rows = await vendorRepository.findReferralAttributedVendors(limit);
    const referralVendorIds = Array.from(
      new Set(
        rows
          .map((item) => (item.referredByVendorId ? String(item.referredByVendorId) : ""))
          .filter(Boolean),
      ),
    );

    const referralVendors = referralVendorIds.length
      ? await vendorRepository.findByIds(referralVendorIds)
      : [];
    const referralVendorMap = new Map(
      referralVendors.map((item) => [
        String(item._id),
        {
          _id: String(item._id),
          businessName: String(item.businessName || ""),
          referralCode: String(item.referralCode || ""),
        },
      ]),
    );

    const mapped = rows.map((item) => {
      const raw = mapReferredVendor(item.toObject() as Record<string, unknown>);
      return {
        ...raw,
        referredByVendor: raw.referredByVendorId
          ? referralVendorMap.get(raw.referredByVendorId) || null
          : null,
      };
    });

    return {
      summary: {
        totalReferredVendors: mapped.length,
        activeReferredVendors: mapped.filter((item) => item.isActive).length,
        pendingReferredVendors: mapped.filter((item) => item.approvalStatus === "pending").length,
      },
      vendors: mapped,
    };
  },
};
