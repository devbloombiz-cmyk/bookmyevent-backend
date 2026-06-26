import crypto from "crypto";
import { venueOwnerRepository } from "../repositories/venue-owner.repository";
import { userRepository } from "../repositories/user.repository";
import { vendorRepository } from "../repositories/vendor.repository";
import { locationService } from "./location.service";
import { ApiError } from "../utils/api-error";
import type { UserRole } from "../types/domain";
import { hashPassword } from "../utils/password";
import { subscriptionService } from "./subscription.service";
import { subscriptionRepository } from "../repositories/subscription.repository";
import { ultramsgWhatsappService } from "./notifications/whatsapp/ultramsg-whatsapp.service";
import { logger } from "../config/logger";
import { deleteManyFromS3 } from "../utils/s3";

const cleanupVenueOwnerImagesOnUpdate = (
  oldVenue: Record<string, unknown>,
  payload: Record<string, unknown>,
) => {
  const deletedUrls: string[] = [];

  if ("profileImages" in payload && Array.isArray(payload.profileImages)) {
    const oldImages = Array.isArray(oldVenue.profileImages) ? oldVenue.profileImages : [];
    const newImagesSet = new Set(payload.profileImages.map((url) => String(url || "").trim()));

    for (const url of oldImages) {
      const trimmedUrl = String(url || "").trim();
      if (trimmedUrl && !newImagesSet.has(trimmedUrl)) {
        deletedUrls.push(trimmedUrl);
      }
    }
  }

  if ("venuePackages" in payload && Array.isArray(payload.venuePackages)) {
    const newPackageImages = new Set<string>();
    for (const pkg of payload.venuePackages) {
      if (pkg && typeof pkg === "object") {
        const cover = String((pkg as Record<string, unknown>).coverImage || "").trim();
        if (cover) newPackageImages.add(cover);

        const portfolio = (pkg as Record<string, unknown>).portfolioImages;
        if (Array.isArray(portfolio)) {
          for (const url of portfolio) {
            const trimmed = String(url || "").trim();
            if (trimmed) newPackageImages.add(trimmed);
          }
        }
      }
    }

    const oldPackages = Array.isArray(oldVenue.venuePackages) ? oldVenue.venuePackages : [];
    for (const pkg of oldPackages) {
      if (pkg && typeof pkg === "object") {
        const cover = String((pkg as Record<string, unknown>).coverImage || "").trim();
        if (cover && !newPackageImages.has(cover)) {
          deletedUrls.push(cover);
        }

        const portfolio = (pkg as Record<string, unknown>).portfolioImages;
        if (Array.isArray(portfolio)) {
          for (const url of portfolio) {
            const trimmed = String(url || "").trim();
            if (trimmed && !newPackageImages.has(trimmed)) {
              deletedUrls.push(trimmed);
            }
          }
        }
      }
    }
  }

  if (deletedUrls.length > 0) {
    deleteManyFromS3(deletedUrls).catch((err) => {
      logger.error({ err, deletedUrls }, "Error in cleanupVenueOwnerImagesOnUpdate S3 deletion");
    });
  }
};

const cleanupVenueOwnerImagesOnDelete = (venueOwner: Record<string, unknown>) => {
  const urlsToDelete: string[] = [];

  if (Array.isArray(venueOwner.profileImages)) {
    for (const url of venueOwner.profileImages) {
      if (url) urlsToDelete.push(String(url));
    }
  }

  if (Array.isArray(venueOwner.venuePackages)) {
    for (const pkg of venueOwner.venuePackages) {
      if (pkg && typeof pkg === "object") {
        const cover = String((pkg as Record<string, unknown>).coverImage || "").trim();
        if (cover) urlsToDelete.push(cover);

        const portfolio = (pkg as Record<string, unknown>).portfolioImages;
        if (Array.isArray(portfolio)) {
          for (const url of portfolio) {
            if (url) urlsToDelete.push(String(url));
          }
        }
      }
    }
  }

  if (urlsToDelete.length > 0) {
    deleteManyFromS3(urlsToDelete).catch((err) => {
      logger.error({ err, urlsToDelete }, "Error in cleanupVenueOwnerImagesOnDelete S3 deletion");
    });
  }
};

const defaultIncludedServiceItems = [
  "Hall Rental",
  "Basic Decoration",
  "Seating Arrangement",
  "Basic Lighting",
  "Stage Setup",
  "Food / Catering",
];

const legacyVenueTypeToCanonical: Record<string, string[]> = {
  "Auditorium & Convention Centres": ["AC_HALL"],
  "Banquet Halls": ["NON_AC_HALL"],
  "Outdoor Venues": ["OUTDOOR"],
  "Hotels & Resorts": ["HOTEL", "RESORT"],
  "Conference / Meeting Halls": ["AC_HALL"],
  "AC hall": ["AC_HALL"],
};

const canonicalVenueTypeToLegacy: Record<string, string> = {
  AC_HALL: "AC hall",
  NON_AC_HALL: "Banquet Halls",
  OUTDOOR: "Outdoor Venues",
  RESORT: "Hotels & Resorts",
  HOTEL: "Hotels & Resorts",
};

const toCanonicalPriceType = (value: unknown) => {
  if (value === "per_day" || value === "PER_DAY") return "PER_DAY";
  if (value === "per_plate" || value === "PER_PLATE") return "PER_PLATE";
  return "PER_EVENT";
};

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

const listFields = (value: unknown) =>
  Array.isArray(value)
    ? value
        .filter((item): item is string => typeof item === "string")
        .map((item) => item.trim())
        .filter(Boolean)
    : [];

const normalizeFoodOption = (option: unknown) => {
  const src =
    typeof option === "object" && option !== null ? (option as Record<string, unknown>) : {};
  return {
    packageName: normalizeText(src.packageName),
    foodTypes: listFields(src.foodTypes),
    priceType:
      src.priceType === "price_per_plate" ||
      src.priceType === "extra_addon" ||
      src.priceType === "included_in_package"
        ? src.priceType
        : "included_in_package",
    pricePerPlate: typeof src.pricePerPlate === "number" ? Math.max(0, src.pricePerPlate) : 0,
    addonPrice: typeof src.addonPrice === "number" ? Math.max(0, src.addonPrice) : 0,
    menuItems: listFields(src.menuItems),
  };
};

const normalizeIncludedServiceItems = (value: unknown) => {
  const asObjects = Array.isArray(value)
    ? value
        .map((item) => {
          const src =
            typeof item === "object" && item !== null ? (item as Record<string, unknown>) : null;
          if (!src) {
            return null;
          }

          const label = normalizeText(src.label);
          if (!label) {
            return null;
          }

          return {
            enabled: src.enabled !== false,
            label,
            description: normalizeText(src.description),
          };
        })
        .filter((item): item is { enabled: boolean; label: string; description: string } =>
          Boolean(item),
        )
    : [];

  if (asObjects.length) {
    return asObjects;
  }

  return defaultIncludedServiceItems.map((label) => ({
    enabled: false,
    label,
    description: "",
  }));
};

const normalizeCustomInclusions = (value: unknown) =>
  Array.isArray(value)
    ? value
        .map((item) => {
          const src =
            typeof item === "object" && item !== null ? (item as Record<string, unknown>) : null;
          if (!src) {
            return null;
          }

          const title = normalizeText(src.title);
          if (!title) {
            return null;
          }

          return {
            title,
            description: normalizeText(src.description),
          };
        })
        .filter((item): item is { title: string; description: string } => Boolean(item))
    : [];

const normalizeFoodAndCatering = (value: unknown, fallback: Record<string, unknown>) => {
  const src = typeof value === "object" && value !== null ? (value as Record<string, unknown>) : {};
  const foodIncluded = src.foodIncluded === true;
  const foodPriceType =
    src.foodPriceType === "PRICE_PER_PLATE" ||
    src.foodPriceType === "EXTRA_ADDON" ||
    src.foodPriceType === "INCLUDED_IN_PACKAGE"
      ? src.foodPriceType
      : "INCLUDED_IN_PACKAGE";

  const additionalFoodOptions =
    typeof src.additionalFoodOptions === "object" && src.additionalFoodOptions !== null
      ? (src.additionalFoodOptions as Record<string, unknown>)
      : {};

  return {
    foodIncluded,
    foodPackageName: normalizeText(src.foodPackageName),
    foodType:
      src.foodType === "SADYA" ||
      src.foodType === "VEG" ||
      src.foodType === "NON_VEG" ||
      src.foodType === "BUFFET" ||
      src.foodType === "CUSTOM"
        ? src.foodType
        : "CUSTOM",
    foodPriceType,
    pricePerPlate: typeof src.pricePerPlate === "number" ? Math.max(0, src.pricePerPlate) : 0,
    menuItems: listFields(src.menuItems),
    additionalFoodOptions: {
      minPlateCount:
        typeof additionalFoodOptions.minPlateCount === "number"
          ? Math.max(0, additionalFoodOptions.minPlateCount)
          : 0,
      maxPlateCount:
        typeof additionalFoodOptions.maxPlateCount === "number"
          ? Math.max(0, additionalFoodOptions.maxPlateCount)
          : 0,
      welcomeDrinkIncluded:
        additionalFoodOptions.welcomeDrinkIncluded === true ||
        fallback.welcomeDrinkIncluded === true,
      dessertIncluded:
        additionalFoodOptions.dessertIncluded === true || fallback.dessertIncluded === true,
      customMenuAvailable:
        additionalFoodOptions.customMenuAvailable === true || fallback.customMenuAvailable === true,
    },
  };
};

const normalizeVenueTypes = (venueType: unknown, venueTypes: unknown) => {
  if (Array.isArray(venueTypes)) {
    const normalized = venueTypes
      .filter((item): item is string => typeof item === "string")
      .map((item) => item.trim())
      .filter(
        (item): item is "AC_HALL" | "NON_AC_HALL" | "OUTDOOR" | "RESORT" | "HOTEL" =>
          item === "AC_HALL" ||
          item === "NON_AC_HALL" ||
          item === "OUTDOOR" ||
          item === "RESORT" ||
          item === "HOTEL",
      );
    if (normalized.length) {
      return normalized;
    }
  }

  const normalizedSingle = normalizeText(venueType);
  if (!normalizedSingle) {
    return [];
  }

  if (normalizedSingle in legacyVenueTypeToCanonical) {
    return legacyVenueTypeToCanonical[normalizedSingle];
  }

  if (normalizedSingle in canonicalVenueTypeToLegacy) {
    return [normalizedSingle];
  }

  return [];
};

const isCanonicalVenueType = (value: string) =>
  value === "AC_HALL" ||
  value === "NON_AC_HALL" ||
  value === "OUTDOOR" ||
  value === "RESORT" ||
  value === "HOTEL";

const normalizeFoodMenu = (menu: unknown) => {
  const src = typeof menu === "object" && menu !== null ? (menu as Record<string, unknown>) : {};
  return {
    name: normalizeText(src.name),
    includes: listFields(src.includes),
  };
};

const normalizeTimeValue = (value: unknown) => {
  const normalized = normalizeText(value);
  if (!normalized) {
    return "";
  }

  return /^([01]\d|2[0-3]):([0-5]\d)$/.test(normalized) ? normalized : "";
};

const uniqueList = (value: unknown) => Array.from(new Set(listFields(value)));

const normalizeVenuePackage = (pkg: unknown) => {
  const src = typeof pkg === "object" && pkg !== null ? (pkg as Record<string, unknown>) : {};
  const minGuestCapacity =
    typeof src.minGuestCapacity === "number" ? Math.max(0, src.minGuestCapacity) : 0;
  const seatingCapacity =
    typeof src.seatingCapacity === "number" ? Math.max(0, src.seatingCapacity) : 0;
  const maxGuestCapacity =
    typeof src.maxGuestCapacity === "number" ? Math.max(0, src.maxGuestCapacity) : 0;

  const cappedMinGuestCapacity =
    seatingCapacity > 0 ? Math.min(minGuestCapacity, seatingCapacity) : minGuestCapacity;
  const cappedSeatingCapacity =
    maxGuestCapacity > 0 ? Math.min(seatingCapacity, maxGuestCapacity) : seatingCapacity;

  const includedServicesDetailed = normalizeIncludedServiceItems(src.includedServicesDetailed);
  const enabledServiceLabels = includedServicesDetailed
    .filter((item) => item.enabled)
    .map((item) => item.label);

  return {
    packageName: normalizeText(src.packageName),
    basePrice:
      typeof src.basePrice === "number"
        ? Math.max(0, src.basePrice)
        : typeof src.price === "number"
          ? Math.max(0, src.price)
          : 0,
    price:
      typeof src.basePrice === "number"
        ? Math.max(0, src.basePrice)
        : typeof src.price === "number"
          ? Math.max(0, src.price)
          : 0,
    priceType: toCanonicalPriceType(src.priceType),
    description: normalizeText(src.description),
    descriptionHighlights: listFields(src.descriptionHighlights),
    coverImage: normalizeText(src.coverImage),
    portfolioImages: uniqueList(src.portfolioImages),
    videoLinks: uniqueList(src.videoLinks)
      .map((item) => normalizeUrl(item))
      .filter(Boolean),
    venueStartTime: normalizeTimeValue(src.venueStartTime),
    venueEndTime: normalizeTimeValue(src.venueEndTime),
    inclusions: listFields(src.inclusions),
    minGuestCapacity: cappedMinGuestCapacity,
    seatingCapacity: cappedSeatingCapacity,
    maxGuestCapacity: maxGuestCapacity,
    parkingVehicleCount:
      typeof src.parkingVehicleCount === "number" ? Math.max(0, src.parkingVehicleCount) : 0,
    roomsAvailableCount:
      typeof src.roomsAvailableCount === "number" ? Math.max(0, src.roomsAvailableCount) : 0,
    includedServices: enabledServiceLabels.length
      ? enabledServiceLabels
      : listFields(src.includedServices),
    includedServicesDetailed,
    additionalServices: listFields(src.additionalServices),
    foodAndCatering: normalizeFoodAndCatering(src.foodAndCatering, src),
    customInclusions: normalizeCustomInclusions(src.customInclusions),
    foodOptions: Array.isArray(src.foodOptions) ? src.foodOptions.map(normalizeFoodOption) : [],
    foodMenus: Array.isArray(src.foodMenus) ? src.foodMenus.map(normalizeFoodMenu) : [],
    welcomeDrinkIncluded: src.welcomeDrinkIncluded === true,
    dessertIncluded: src.dessertIncluded === true,
    customMenuAvailable: src.customMenuAvailable === true,
    isActive: src.isActive !== false,
  };
};

const normalizePayload = (payload: Record<string, unknown>, options: { partial: boolean }) => {
  const normalized: Record<string, unknown> = { ...payload };
  const textFields = [
    "businessName",
    "ownerName",
    "state",
    "district",
    "city",
    "locationDisplayName",
    "addressLine",
    "description",
  ] as const;

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

  if (!options.partial || "profileImages" in payload || "profileImage" in payload) {
    const profileImages = listFields(payload.profileImages);
    const legacyProfileImage = normalizeUrl(payload.profileImage);
    normalized.profileImages = profileImages.length
      ? profileImages
      : legacyProfileImage
        ? [legacyProfileImage]
        : [];
  }

  if (!options.partial || "venuePackages" in payload) {
    normalized.venuePackages = Array.isArray(payload.venuePackages)
      ? payload.venuePackages.map(normalizeVenuePackage)
      : [];
  }

  if (!options.partial || "venueType" in payload || "venueTypes" in payload) {
    const venueTypes = normalizeVenueTypes(payload.venueType, payload.venueTypes);
    normalized.venueTypes = venueTypes;
    const rawVenueType = normalizeText(payload.venueType);
    const topVenueType = venueTypes[0];
    if (rawVenueType && rawVenueType in legacyVenueTypeToCanonical) {
      normalized.venueType = rawVenueType;
    } else if (rawVenueType && !isCanonicalVenueType(rawVenueType)) {
      normalized.venueType = rawVenueType;
    } else {
      normalized.venueType = topVenueType ? canonicalVenueTypeToLegacy[topVenueType] : rawVenueType;
    }
  }

  if (!options.partial || "guestCapacity" in payload) {
    const guestCapacity =
      typeof payload.guestCapacity === "object" && payload.guestCapacity !== null
        ? (payload.guestCapacity as Record<string, unknown>)
        : {};
    normalized.guestCapacity = {
      minGuests:
        typeof guestCapacity.minGuests === "number" ? Math.max(0, guestCapacity.minGuests) : 0,
      maxGuests:
        typeof guestCapacity.maxGuests === "number" ? Math.max(0, guestCapacity.maxGuests) : 0,
    };
  }

  if (!options.partial || "parkingAvailable" in payload) {
    normalized.parkingAvailable = payload.parkingAvailable === true;
  }

  if (!options.partial || "parkingCapacity" in payload) {
    normalized.parkingCapacity =
      typeof payload.parkingCapacity === "number" ? Math.max(0, payload.parkingCapacity) : 0;
  }

  if (!options.partial || "roomsAvailable" in payload) {
    normalized.roomsAvailable = payload.roomsAvailable === true;
  }

  if (!options.partial || "roomCount" in payload) {
    normalized.roomCount =
      typeof payload.roomCount === "number" ? Math.max(0, payload.roomCount) : 0;
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

const ensureVenueOwnerUserAccount = async (payload: Record<string, unknown>) => {
  const email = normalizeText(payload.email).toLowerCase();
  const mobile = normalizeText(payload.mobile);
  if (!email || !mobile) {
    return null;
  }

  const name =
    normalizeText(payload.ownerName) || normalizeText(payload.businessName) || "Venue Owner";

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
      role: "venue_owner",
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
    role: "venue_owner",
  });
};

const syncUserAccount = async (
  userId: string | undefined | null,
  normalizedPayload: Record<string, unknown>,
  existingVenueOwner: Record<string, unknown>,
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
    const ownerName = normalizeText(normalizedPayload.ownerName ?? existingVenueOwner.ownerName);
    const businessName = normalizeText(
      normalizedPayload.businessName ?? existingVenueOwner.businessName,
    );
    updatePayload.name = ownerName || businessName || "Venue Owner";
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

const syncShadowVendor = async (
  linkedVendorId: string | undefined | null,
  normalizedPayload: Record<string, unknown>,
) => {
  const vendorId = linkedVendorId ? String(linkedVendorId) : "";
  if (!vendorId) {
    return;
  }

  const updatePayload: Record<string, unknown> = {};

  if ("ownerName" in normalizedPayload) {
    updatePayload.ownerName = normalizedPayload.ownerName;
  }
  if ("businessName" in normalizedPayload) {
    updatePayload.businessName = normalizedPayload.businessName;
  }
  if ("email" in normalizedPayload) {
    updatePayload.email = normalizedPayload.email;
  }
  if ("mobile" in normalizedPayload) {
    updatePayload.mobile = normalizedPayload.mobile;
  }

  if (Object.keys(updatePayload).length > 0) {
    await vendorRepository.updateById(vendorId, updatePayload);
  }
};

const syncVenueOwnerUserStatus = async (
  venueOwnerRecord: Record<string, unknown>,
  payload: Record<string, unknown>,
) => {
  const email = normalizeText(venueOwnerRecord.email || payload.email).toLowerCase();
  const mobile = normalizeText(venueOwnerRecord.mobile || payload.mobile);
  const linkedUserId =
    typeof venueOwnerRecord.userId === "string"
      ? venueOwnerRecord.userId
      : venueOwnerRecord.userId
        ? String(venueOwnerRecord.userId)
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

  const approvalStatus = normalizeText(payload.approvalStatus || venueOwnerRecord.approvalStatus);
  const isRecordActive =
    typeof payload.isActive === "boolean"
      ? payload.isActive
      : typeof venueOwnerRecord.isActive === "boolean"
        ? venueOwnerRecord.isActive
        : true;

  const shouldBeActive = isRecordActive && approvalStatus === "active";
  await userRepository.updateById(user.id, {
    isActive: shouldBeActive,
    role: "venue_owner",
  });
};

const ensureVenueOwnerProfileUniqueness = async (options: {
  email?: string;
  mobile?: string;
  excludeVenueOwnerId?: string;
}) => {
  const normalizedEmail = normalizeText(options.email).toLowerCase();
  const normalizedMobile = normalizeText(options.mobile);
  const existingVenueOwner = await venueOwnerRepository.findByEmailOrMobile(
    normalizedEmail,
    normalizedMobile,
  );

  if (!existingVenueOwner) {
    return;
  }

  if (
    options.excludeVenueOwnerId &&
    String(existingVenueOwner._id) === options.excludeVenueOwnerId
  ) {
    return;
  }

  throw new ApiError(409, "Venue owner already exists for this email or mobile");
};

const notifyVenueOwnerApprovalActivated = async (venueOwnerRecord: Record<string, unknown>) => {
  const mobile = normalizeText(venueOwnerRecord.mobile);
  if (!mobile || !ultramsgWhatsappService.isEnabled()) {
    return;
  }

  const businessName = normalizeText(venueOwnerRecord.businessName) || "your venue profile";
  const message = `BookMyEvent update: ${businessName} is approved. You can now login at www.bookmyevent.ae/login and continue onboarding.`;

  try {
    await ultramsgWhatsappService.sendMessage({
      to: mobile,
      body: message,
      context: "venue_owner_approval",
    });
  } catch (error) {
    logger.warn(
      {
        venueOwnerId: String(venueOwnerRecord._id || ""),
        mobile,
        error,
      },
      "Unable to send venue owner approval WhatsApp notification",
    );
  }
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

export const venueOwnerService = {
  createVenueOwner: async (
    payload: Record<string, unknown>,
    options?: { requestedByRole?: UserRole },
  ) => {
    const normalizedPayload = normalizePayload(payload, { partial: false });
    const normalizedEmail = normalizeText(normalizedPayload.email).toLowerCase();
    const normalizedMobile = normalizeText(normalizedPayload.mobile);

    await ensureVenueOwnerProfileUniqueness({
      email: normalizedEmail,
      mobile: normalizedMobile,
    });

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
      normalizedPayload.isActive = true;
    }

    await syncLocationIfPresent(normalizedPayload);

    const venueOwner = await venueOwnerRepository.create(normalizedPayload);
    const linkedUser = await (async () => {
      try {
        return await ensureVenueOwnerUserAccount(normalizedPayload);
      } catch (error) {
        try {
          await venueOwnerRepository.deleteById(String(venueOwner._id));
        } catch (rollbackError) {
          logger.error(
            {
              venueOwnerId: String(venueOwner._id),
              rollbackError,
            },
            "Failed to rollback venue owner record after user-link failure",
          );
        }
        throw error;
      }
    })();

    let persistedVenueOwner = venueOwner;
    if (linkedUser?._id) {
      const updatedVenueOwner = await venueOwnerRepository.updateById(String(venueOwner._id), {
        userId: linkedUser._id,
      });
      if (!updatedVenueOwner) {
        await venueOwnerRepository.deleteById(String(venueOwner._id));
        throw new ApiError(500, "Unable to link venue owner account. Please try again.");
      }
      normalizedPayload.userId = linkedUser._id;
      persistedVenueOwner = updatedVenueOwner;
    }

    await syncVenueOwnerUserStatus(persistedVenueOwner.toObject(), normalizedPayload);
    return venueOwnerRepository.findById(String(persistedVenueOwner._id));
  },
  listVenueOwners: async (filters: Record<string, unknown>) => {
    const venueOwners = await venueOwnerRepository.findAll(filters);
    const venueOwnerIds = venueOwners.map((item) => String(item._id));
    const activeProRows = await subscriptionRepository.findActiveProByActorIds(
      "venue_owner",
      venueOwnerIds,
    );
    const activeProIdSet = new Set(activeProRows.map((item) => String(item.actorId)));

    return venueOwners.map((venueOwner) => {
      const row = venueOwner.toObject() as Record<string, unknown>;
      const isSubscribedPro = activeProIdSet.has(String(venueOwner._id));
      return {
        ...row,
        isSubscribedPro,
      };
    });
  },
  getMyVenueOwnerProfile: async (authUser: { id: string }) => {
    const venueOwnerByUserId = await venueOwnerRepository.findByUserId(authUser.id);
    if (venueOwnerByUserId) {
      return venueOwnerByUserId;
    }

    const user = await userRepository.findById(authUser.id);
    if (!user) {
      throw new ApiError(404, "User not found");
    }

    const venueOwner = await venueOwnerRepository.findByEmailOrMobile(user.email, user.mobile);
    if (!venueOwner) {
      throw new ApiError(404, "Venue owner profile not found");
    }

    if (!venueOwner.userId) {
      await venueOwnerRepository.updateById(String(venueOwner._id), {
        userId: authUser.id,
      });
    }

    const activeProRows = await subscriptionRepository.findActiveProByActorIds("venue_owner", [
      String(venueOwner._id),
    ]);
    const isSubscribedPro = activeProRows.length > 0;

    return {
      ...(venueOwner.toObject() as Record<string, unknown>),
      isSubscribedPro,
    };
  },
  getVenueOwnerById: async (venueOwnerId: string, includeInactive = false) => {
    const venueOwner = await venueOwnerRepository.findById(venueOwnerId);
    if (!venueOwner) {
      throw new ApiError(404, "Venue owner not found");
    }

    if (!includeInactive && (!venueOwner.isActive || venueOwner.approvalStatus !== "active")) {
      throw new ApiError(404, "Venue owner not found");
    }

    const activeProRows = await subscriptionRepository.findActiveProByActorIds("venue_owner", [
      venueOwnerId,
    ]);
    const isSubscribedPro = activeProRows.length > 0;

    return {
      ...(venueOwner.toObject() as Record<string, unknown>),
      isSubscribedPro,
    };
  },
  updateVenueOwner: async (venueOwnerId: string, payload: Record<string, unknown>) => {
    const existingVenueOwner = await venueOwnerRepository.findById(venueOwnerId);
    if (!existingVenueOwner) {
      throw new ApiError(404, "Venue owner not found");
    }

    const normalizedPayload = normalizePayload(payload, { partial: true });
    const previousApprovalStatus = normalizeText(existingVenueOwner.approvalStatus);

    await ensureVenueOwnerProfileUniqueness({
      email: String(normalizedPayload.email ?? existingVenueOwner.email ?? ""),
      mobile: String(normalizedPayload.mobile ?? existingVenueOwner.mobile ?? ""),
      excludeVenueOwnerId: venueOwnerId,
    });

    const linkedUserId = existingVenueOwner.userId;
    if (linkedUserId) {
      await syncUserAccount(String(linkedUserId), normalizedPayload, existingVenueOwner.toObject());
    } else {
      const linkedUser = await ensureVenueOwnerUserAccount({
        email: normalizedPayload.email ?? existingVenueOwner.email,
        mobile: normalizedPayload.mobile ?? existingVenueOwner.mobile,
        ownerName: normalizedPayload.ownerName ?? existingVenueOwner.ownerName,
        businessName: normalizedPayload.businessName ?? existingVenueOwner.businessName,
      });
      if (linkedUser?._id) {
        normalizedPayload.userId = linkedUser._id;
      }
    }

    if (existingVenueOwner.linkedVendorId) {
      await syncShadowVendor(String(existingVenueOwner.linkedVendorId), normalizedPayload);
    }

    await syncLocationIfPresent(normalizedPayload);

    const venueOwner = await venueOwnerRepository.updateById(venueOwnerId, normalizedPayload);
    if (!venueOwner) {
      throw new ApiError(404, "Venue owner not found");
    }

    cleanupVenueOwnerImagesOnUpdate(
      existingVenueOwner.toObject ? existingVenueOwner.toObject() : existingVenueOwner,
      normalizedPayload,
    );

    await syncVenueOwnerUserStatus(venueOwner.toObject(), normalizedPayload);

    const nextApprovalStatus = normalizeText(venueOwner.approvalStatus);
    if (previousApprovalStatus === "pending" && nextApprovalStatus === "active") {
      await notifyVenueOwnerApprovalActivated(venueOwner.toObject());
    }

    return venueOwnerRepository.findById(venueOwnerId);
  },
  updateMyVenueOwnerProfile: async (authUser: { id: string }, payload: Record<string, unknown>) => {
    const venueOwnerByUserId = await venueOwnerRepository.findByUserId(authUser.id);
    if (venueOwnerByUserId) {
      const normalizedPayload = normalizePayload(payload, { partial: true });
      await ensureVenueOwnerProfileUniqueness({
        email: String(normalizedPayload.email ?? venueOwnerByUserId.email ?? ""),
        mobile: String(normalizedPayload.mobile ?? venueOwnerByUserId.mobile ?? ""),
        excludeVenueOwnerId: String(venueOwnerByUserId._id),
      });

      if (Array.isArray(normalizedPayload.venuePackages)) {
        const packageCount = normalizedPayload.venuePackages.length;
        const totalVideos = normalizedPayload.venuePackages.reduce((acc, pkg) => {
          if (!pkg || typeof pkg !== "object") {
            return acc;
          }

          const links = (pkg as Record<string, unknown>).videoLinks;
          const count = Array.isArray(links) ? links.length : 0;
          return acc + count;
        }, 0);
        const packagePortfolioImages = normalizedPayload.venuePackages.reduce((acc, pkg) => {
          if (!pkg || typeof pkg !== "object") {
            return acc;
          }

          const images = (pkg as Record<string, unknown>).portfolioImages;
          const count = Array.isArray(images) ? images.length : 0;
          return acc + count;
        }, 0);
        const topLevelProfileImages = Array.isArray(normalizedPayload.profileImages)
          ? normalizedPayload.profileImages.length
          : Array.isArray(venueOwnerByUserId.profileImages)
            ? venueOwnerByUserId.profileImages.length
            : 0;

        await subscriptionService.assertWithinLimit(
          { id: authUser.id, role: "venue_owner" },
          "maxPackages",
          packageCount,
        );
        await subscriptionService.assertWithinLimit(
          { id: authUser.id, role: "venue_owner" },
          "maxVideoLinks",
          totalVideos,
        );
        await subscriptionService.assertWithinLimit(
          { id: authUser.id, role: "venue_owner" },
          "maxPortfolioImages",
          packagePortfolioImages + topLevelProfileImages,
        );
      }

      if (Array.isArray(normalizedPayload.profileImages)) {
        await subscriptionService.assertWithinLimit(
          { id: authUser.id, role: "venue_owner" },
          "maxPortfolioImages",
          normalizedPayload.profileImages.length,
        );
      }

      await syncLocationIfPresent(normalizedPayload);

      await syncUserAccount(
        String(venueOwnerByUserId.userId || authUser.id),
        normalizedPayload,
        venueOwnerByUserId.toObject(),
      );

      if (venueOwnerByUserId.linkedVendorId) {
        await syncShadowVendor(String(venueOwnerByUserId.linkedVendorId), normalizedPayload);
      }

      const updatedVenueOwner = await venueOwnerRepository.updateById(
        String(venueOwnerByUserId._id),
        normalizedPayload,
      );
      if (!updatedVenueOwner) {
        throw new ApiError(404, "Venue owner not found");
      }

      cleanupVenueOwnerImagesOnUpdate(
        venueOwnerByUserId.toObject ? venueOwnerByUserId.toObject() : venueOwnerByUserId,
        normalizedPayload,
      );

      return updatedVenueOwner;
    }

    const user = await userRepository.findById(authUser.id);
    if (!user) {
      throw new ApiError(404, "User not found");
    }

    const venueOwner = await venueOwnerRepository.findByEmailOrMobile(user.email, user.mobile);
    if (!venueOwner) {
      throw new ApiError(404, "Venue owner profile not found");
    }

    if (!venueOwner.userId) {
      await venueOwnerRepository.updateById(String(venueOwner._id), {
        userId: authUser.id,
      });
    }

    const normalizedPayload = normalizePayload(payload, { partial: true });
    await ensureVenueOwnerProfileUniqueness({
      email: String(normalizedPayload.email ?? venueOwner.email ?? ""),
      mobile: String(normalizedPayload.mobile ?? venueOwner.mobile ?? ""),
      excludeVenueOwnerId: String(venueOwner._id),
    });

    if (Array.isArray(normalizedPayload.venuePackages)) {
      const packageCount = normalizedPayload.venuePackages.length;
      const totalVideos = normalizedPayload.venuePackages.reduce((acc, pkg) => {
        if (!pkg || typeof pkg !== "object") {
          return acc;
        }

        const links = (pkg as Record<string, unknown>).videoLinks;
        const count = Array.isArray(links) ? links.length : 0;
        return acc + count;
      }, 0);
      const packagePortfolioImages = normalizedPayload.venuePackages.reduce((acc, pkg) => {
        if (!pkg || typeof pkg !== "object") {
          return acc;
        }

        const images = (pkg as Record<string, unknown>).portfolioImages;
        const count = Array.isArray(images) ? images.length : 0;
        return acc + count;
      }, 0);
      const topLevelProfileImages = Array.isArray(normalizedPayload.profileImages)
        ? normalizedPayload.profileImages.length
        : Array.isArray(venueOwner.profileImages)
          ? venueOwner.profileImages.length
          : 0;

      await subscriptionService.assertWithinLimit(
        { id: authUser.id, role: "venue_owner" },
        "maxPackages",
        packageCount,
      );
      await subscriptionService.assertWithinLimit(
        { id: authUser.id, role: "venue_owner" },
        "maxVideoLinks",
        totalVideos,
      );
      await subscriptionService.assertWithinLimit(
        { id: authUser.id, role: "venue_owner" },
        "maxPortfolioImages",
        packagePortfolioImages + topLevelProfileImages,
      );
    }

    if (Array.isArray(normalizedPayload.profileImages)) {
      await subscriptionService.assertWithinLimit(
        { id: authUser.id, role: "venue_owner" },
        "maxPortfolioImages",
        normalizedPayload.profileImages.length,
      );
    }

    await syncLocationIfPresent(normalizedPayload);

    await syncUserAccount(
      String(venueOwner.userId || authUser.id),
      normalizedPayload,
      venueOwner.toObject(),
    );

    if (venueOwner.linkedVendorId) {
      await syncShadowVendor(String(venueOwner.linkedVendorId), normalizedPayload);
    }

    const updatedVenueOwner = await venueOwnerRepository.updateById(
      String(venueOwner._id),
      normalizedPayload,
    );
    if (!updatedVenueOwner) {
      throw new ApiError(404, "Venue owner not found");
    }

    cleanupVenueOwnerImagesOnUpdate(
      venueOwner.toObject ? venueOwner.toObject() : venueOwner,
      normalizedPayload,
    );

    return updatedVenueOwner;
  },
  deleteVenueOwner: async (venueOwnerId: string) => {
    const venueOwner = await venueOwnerRepository.deleteById(venueOwnerId);
    if (!venueOwner) {
      throw new ApiError(404, "Venue owner not found");
    }

    cleanupVenueOwnerImagesOnDelete(venueOwner.toObject ? venueOwner.toObject() : venueOwner);

    if (venueOwner.userId) {
      await userRepository.deleteById(String(venueOwner.userId));
    }

    return venueOwner;
  },
};
