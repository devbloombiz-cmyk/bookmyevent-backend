import crypto from "crypto";
import { vendorRepository } from "../repositories/vendor.repository";
import { userRepository } from "../repositories/user.repository";
import { hashPassword } from "../utils/password";
import { ApiError } from "../utils/api-error";
import { galleryService } from "./gallery.service";
import { locationService } from "./location.service";
import type { UserRole } from "../types/domain";

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
  "paymentTerms",
  "travelCost",
  "deliveryTime",
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

  if (!options.partial || "portfolioImages" in payload) {
    normalized.portfolioImages = Array.isArray(payload.portfolioImages)
      ? payload.portfolioImages
          .filter((item): item is string => typeof item === "string")
          .map((item) => item.trim())
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
    return;
  }
  const name = normalizeText(payload.ownerName) || normalizeText(payload.businessName) || "Vendor";

  const [userByMobile, userByEmail] = await Promise.all([
    userRepository.findByMobile(mobile),
    userRepository.findByEmail(email),
  ]);

  const existingUser = userByMobile ?? userByEmail;
  if (existingUser) {
    await userRepository.updateById(existingUser.id, {
      name,
      email,
      mobile,
      role: "vendor",
      isActive: true,
    });
    return;
  }

  const passwordHash = await hashPassword(crypto.randomBytes(18).toString("hex"));
  await userRepository.create({
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

export const vendorService = {
  createVendor: async (
    payload: Record<string, unknown>,
    options?: { requestedByRole?: UserRole },
  ) => {
    const normalizedPayload = buildNormalizedVendorPayload(payload, { partial: false });

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

    await Promise.all([ensureVendorUserAccount(normalizedPayload), syncLocationIfPresent(normalizedPayload)]);

    const vendor = await vendorRepository.create(normalizedPayload);

    const portfolioImages = Array.isArray(normalizedPayload.portfolioImages)
      ? normalizedPayload.portfolioImages.filter((item): item is string => typeof item === "string" && item.trim().length > 0)
      : [];

    await galleryService.createVendorPortfolioGalleryItems({
      vendorId: String(vendor._id),
      vendorName: String(vendor.businessName ?? "Vendor"),
      category: String(vendor.category ?? "general"),
      subCategory: String(vendor.subCategory ?? ""),
      city: String(vendor.city ?? ""),
      mediaUrls: portfolioImages,
    });

    return vendor;
  },
  listVendors: (filters: Record<string, unknown>) => vendorRepository.findAll(filters),
  getVendorById: async (vendorId: string, includeInactive = false) => {
    const vendor = await vendorRepository.findById(vendorId);
    if (!vendor) {
      throw new ApiError(404, "Vendor not found");
    }

    if (!includeInactive && (!vendor.isActive || vendor.approvalStatus !== "active")) {
      throw new ApiError(404, "Vendor not found");
    }

    return vendor;
  },
  getMyVendorProfile: async (authUser: { id: string; email: string }) => {
    const user = await userRepository.findById(authUser.id);
    if (!user) {
      throw new ApiError(404, "User not found");
    }

    const vendor = await vendorRepository.findByEmailOrMobile(user.email, user.mobile);
    if (!vendor) {
      throw new ApiError(404, "Vendor profile not found");
    }

    return vendor;
  },
  updateMyVendorProfile: async (authUser: { id: string; email: string }, payload: Record<string, unknown>) => {
    const user = await userRepository.findById(authUser.id);
    if (!user) {
      throw new ApiError(404, "User not found");
    }

    const vendor = await vendorRepository.findByEmailOrMobile(user.email, user.mobile);
    if (!vendor) {
      throw new ApiError(404, "Vendor profile not found");
    }

    const normalizedPayload = buildNormalizedVendorPayload(payload, { partial: true });
    await syncLocationIfPresent(normalizedPayload);

    const updatedVendor = await vendorRepository.updateById(String(vendor._id), normalizedPayload);
    if (!updatedVendor) {
      throw new ApiError(404, "Vendor not found");
    }

    return updatedVendor;
  },
  updateVendor: async (vendorId: string, payload: Record<string, unknown>) => {
    const normalizedPayload = buildNormalizedVendorPayload(payload, { partial: true });

    await Promise.all([ensureVendorUserAccount(normalizedPayload), syncLocationIfPresent(normalizedPayload)]);

    const vendor = await vendorRepository.updateById(vendorId, normalizedPayload);
    if (!vendor) {
      throw new ApiError(404, "Vendor not found");
    }
    return vendor;
  },
  deleteVendor: async (vendorId: string) => {
    const vendor = await vendorRepository.deleteById(vendorId);
    if (!vendor) {
      throw new ApiError(404, "Vendor not found");
    }
    return vendor;
  },
};
