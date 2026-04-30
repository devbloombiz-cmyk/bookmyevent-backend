import { venueOwnerRepository } from "../repositories/venue-owner.repository";
import { userRepository } from "../repositories/user.repository";
import { vendorRepository } from "../repositories/vendor.repository";
import { locationService } from "./location.service";
import { ApiError } from "../utils/api-error";
import type { UserRole } from "../types/domain";

const normalizeText = (value: unknown) => (typeof value === "string" ? value.trim() : "");

const listFields = (value: unknown) =>
  Array.isArray(value)
    ? value
        .filter((item): item is string => typeof item === "string")
        .map((item) => item.trim())
        .filter(Boolean)
    : [];

const normalizeFoodOption = (option: unknown) => {
  const src = typeof option === "object" && option !== null ? (option as Record<string, unknown>) : {};
  return {
    packageName: normalizeText(src.packageName),
    foodTypes: listFields(src.foodTypes),
    priceType:
      src.priceType === "price_per_plate" || src.priceType === "extra_addon" || src.priceType === "included_in_package"
        ? src.priceType
        : "included_in_package",
    pricePerPlate: typeof src.pricePerPlate === "number" ? Math.max(0, src.pricePerPlate) : 0,
    addonPrice: typeof src.addonPrice === "number" ? Math.max(0, src.addonPrice) : 0,
    menuItems: listFields(src.menuItems),
  };
};

const normalizeVenuePackage = (pkg: unknown) => {
  const src = typeof pkg === "object" && pkg !== null ? (pkg as Record<string, unknown>) : {};
  return {
    packageName: normalizeText(src.packageName),
    price: typeof src.price === "number" ? Math.max(0, src.price) : 0,
    priceType:
      src.priceType === "per_day" || src.priceType === "per_event" || src.priceType === "per_plate"
        ? src.priceType
        : "per_event",
    description: normalizeText(src.description),
    inclusions: listFields(src.inclusions),
    minGuestCapacity: typeof src.minGuestCapacity === "number" ? Math.max(0, src.minGuestCapacity) : 0,
    maxGuestCapacity: typeof src.maxGuestCapacity === "number" ? Math.max(0, src.maxGuestCapacity) : 0,
    parkingVehicleCount: typeof src.parkingVehicleCount === "number" ? Math.max(0, src.parkingVehicleCount) : 0,
    roomsAvailableCount: typeof src.roomsAvailableCount === "number" ? Math.max(0, src.roomsAvailableCount) : 0,
    includedServices: listFields(src.includedServices),
    additionalServices: listFields(src.additionalServices),
    foodOptions: Array.isArray(src.foodOptions) ? src.foodOptions.map(normalizeFoodOption) : [],
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
    "venueType",
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

  if (!options.partial || "profileImages" in payload) {
    normalized.profileImages = listFields(payload.profileImages);
  }

  if (!options.partial || "venuePackages" in payload) {
    normalized.venuePackages = Array.isArray(payload.venuePackages)
      ? payload.venuePackages.map(normalizeVenuePackage)
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

const syncLocationIfPresent = async (payload: Record<string, unknown>) => {
  const state = normalizeText(payload.state);
  const district = normalizeText(payload.district);
  const city = normalizeText(payload.city);

  if (!state || !district || !city) {
    return;
  }

  await locationService.createLocation({ state, district, city });
};

const syncToVendorProfile = async (venueOwnerRecord: Record<string, unknown>) => {
  const email = normalizeText(venueOwnerRecord.email).toLowerCase();
  const mobile = normalizeText(venueOwnerRecord.mobile);

  if (!email && !mobile) {
    return null;
  }

  const existingVendor = await vendorRepository.findByEmailOrMobile(email, mobile);
  const linkedUser = email
    ? await userRepository.findByEmail(email)
    : mobile
      ? await userRepository.findByMobile(mobile)
      : null;

  const primaryPackage = Array.isArray(venueOwnerRecord.venuePackages)
    ? (venueOwnerRecord.venuePackages[0] as Record<string, unknown> | undefined)
    : undefined;

  const vendorPayload: Record<string, unknown> = {
    businessName: normalizeText(venueOwnerRecord.businessName),
    ownerName: normalizeText(venueOwnerRecord.ownerName),
    email,
    mobile,
    category: "Venue",
    subCategory: normalizeText(venueOwnerRecord.venueType) || "Venue",
    state: normalizeText(venueOwnerRecord.state),
    district: normalizeText(venueOwnerRecord.district),
    city: normalizeText(venueOwnerRecord.city),
    locationDisplayName: normalizeText(venueOwnerRecord.locationDisplayName),
    description: normalizeText(venueOwnerRecord.description),
    approvalStatus: normalizeText(venueOwnerRecord.approvalStatus) === "active" ? "active" : "pending",
    isActive: venueOwnerRecord.isActive !== false,
    isVerified: normalizeText(venueOwnerRecord.approvalStatus) === "active",
    pricingModel: "per_event",
    pricingAmount:
      typeof primaryPackage?.price === "number"
        ? Math.max(0, primaryPackage.price)
        : 0,
    portfolioImages: Array.isArray(venueOwnerRecord.profileImages)
      ? venueOwnerRecord.profileImages
      : [],
    userId: linkedUser?._id ?? existingVendor?.userId ?? null,
  };

  if (existingVendor) {
    return vendorRepository.updateById(String(existingVendor._id), vendorPayload);
  }

  return vendorRepository.create(vendorPayload);
};

export const venueOwnerService = {
  createVenueOwner: async (
    payload: Record<string, unknown>,
    options?: { requestedByRole?: UserRole },
  ) => {
    const normalizedPayload = normalizePayload(payload, { partial: false });

    const privilegedCreatorRoles: UserRole[] = ["super_admin", "vendor_admin", "accounts_admin"];
    const isPrivilegedCreator = options?.requestedByRole
      ? privilegedCreatorRoles.includes(options.requestedByRole)
      : false;

    normalizedPayload.registrationSource = isPrivilegedCreator ? "admin" : "public";

    if (!isPrivilegedCreator) {
      normalizedPayload.approvalStatus = "pending";
      normalizedPayload.isActive = true;
    }

    await syncLocationIfPresent(normalizedPayload);

    const venueOwner = await venueOwnerRepository.create(normalizedPayload);

    if (venueOwner.approvalStatus === "active" && venueOwner.isActive) {
      const vendor = await syncToVendorProfile(venueOwner.toObject());
      if (vendor?._id) {
        await venueOwnerRepository.updateById(String(venueOwner._id), {
          linkedVendorId: vendor._id,
        });
      }
    }

    return venueOwnerRepository.findById(String(venueOwner._id));
  },
  listVenueOwners: (filters: Record<string, unknown>) => venueOwnerRepository.findAll(filters),
  getVenueOwnerById: async (venueOwnerId: string, includeInactive = false) => {
    const venueOwner = await venueOwnerRepository.findById(venueOwnerId);
    if (!venueOwner) {
      throw new ApiError(404, "Venue owner not found");
    }

    if (!includeInactive && (!venueOwner.isActive || venueOwner.approvalStatus !== "active")) {
      throw new ApiError(404, "Venue owner not found");
    }

    return venueOwner;
  },
  updateVenueOwner: async (venueOwnerId: string, payload: Record<string, unknown>) => {
    const existingVenueOwner = await venueOwnerRepository.findById(venueOwnerId);
    if (!existingVenueOwner) {
      throw new ApiError(404, "Venue owner not found");
    }

    const normalizedPayload = normalizePayload(payload, { partial: true });

    await syncLocationIfPresent(normalizedPayload);

    const venueOwner = await venueOwnerRepository.updateById(venueOwnerId, normalizedPayload);
    if (!venueOwner) {
      throw new ApiError(404, "Venue owner not found");
    }

    const shouldSyncVendor =
      (typeof normalizedPayload.approvalStatus === "string" && normalizedPayload.approvalStatus === "active") ||
      (typeof normalizedPayload.isActive === "boolean" && normalizedPayload.isActive === true);

    if (shouldSyncVendor || venueOwner.approvalStatus === "active") {
      const vendor = await syncToVendorProfile(venueOwner.toObject());
      if (vendor?._id && String(venueOwner.linkedVendorId || "") !== String(vendor._id)) {
        await venueOwnerRepository.updateById(venueOwnerId, {
          linkedVendorId: vendor._id,
        });
      }
    }

    return venueOwnerRepository.findById(venueOwnerId);
  },
  deleteVenueOwner: async (venueOwnerId: string) => {
    const venueOwner = await venueOwnerRepository.deleteById(venueOwnerId);
    if (!venueOwner) {
      throw new ApiError(404, "Venue owner not found");
    }

    return venueOwner;
  },
};
