import { z } from "zod";

const venueTypeEnum = z.enum([
  "Auditorium & Convention Centres",
  "Banquet Halls",
  "Outdoor Venues",
  "Hotels & Resorts",
  "Conference / Meeting Halls",
  "AC hall",
]);

const venueFoodOptionSchema = z.object({
  packageName: z.string().min(1),
  foodTypes: z.array(z.string()).optional().default([]),
  priceType: z.enum(["included_in_package", "price_per_plate", "extra_addon"]).optional().default("included_in_package"),
  pricePerPlate: z.number().min(0).optional().default(0),
  addonPrice: z.number().min(0).optional().default(0),
  menuItems: z.array(z.string()).optional().default([]),
});

const venuePackageSchema = z.object({
  packageName: z.string().min(1),
  price: z.number().min(0),
  priceType: z.enum(["per_day", "per_event", "per_plate"]).optional().default("per_event"),
  description: z.string().optional().default(""),
  inclusions: z.array(z.string()).optional().default([]),
  minGuestCapacity: z.number().int().min(0).optional().default(0),
  maxGuestCapacity: z.number().int().min(0).optional().default(0),
  parkingVehicleCount: z.number().int().min(0).optional().default(0),
  roomsAvailableCount: z.number().int().min(0).optional().default(0),
  includedServices: z.array(z.string()).optional().default([]),
  additionalServices: z.array(z.string()).optional().default([]),
  foodOptions: z.array(venueFoodOptionSchema).optional().default([]),
  welcomeDrinkIncluded: z.boolean().optional().default(false),
  dessertIncluded: z.boolean().optional().default(false),
  customMenuAvailable: z.boolean().optional().default(false),
  isActive: z.boolean().optional().default(true),
});

export const createVenueOwnerSchema = z.object({
  body: z.object({
    businessName: z.string().min(2),
    ownerName: z.string().min(2),
    email: z.email(),
    mobile: z.string().min(8).max(20),
    state: z.string().optional().default(""),
    district: z.string().optional().default(""),
    city: z.string().min(2),
    locationDisplayName: z.string().optional().default(""),
    addressLine: z.string().optional().default(""),
    venueType: venueTypeEnum,
    description: z.string().optional().default(""),
    approvalStatus: z.enum(["pending", "active", "disabled"]).optional().default("pending"),
    isActive: z.boolean().optional().default(true),
    profileImages: z.array(z.url()).optional().default([]),
    venuePackages: z.array(venuePackageSchema).optional().default([]),
  }),
  query: z.object({}),
  params: z.object({}),
});

export const updateVenueOwnerSchema = z.object({
  body: z
    .object({
      businessName: z.string().min(2).optional(),
      ownerName: z.string().min(2).optional(),
      email: z.email().optional(),
      mobile: z.string().min(8).max(20).optional(),
      state: z.string().optional(),
      district: z.string().optional(),
      city: z.string().min(2).optional(),
      locationDisplayName: z.string().optional(),
      addressLine: z.string().optional(),
      venueType: venueTypeEnum.optional(),
      description: z.string().optional(),
      approvalStatus: z.enum(["pending", "active", "disabled"]).optional(),
      isActive: z.boolean().optional(),
      profileImages: z.array(z.url()).optional(),
      venuePackages: z.array(venuePackageSchema).optional(),
    })
    .refine((payload) => Object.keys(payload).length > 0, "At least one field is required"),
  query: z.object({}),
  params: z.object({
    venueOwnerId: z.string().min(1),
  }),
});

export const listVenueOwnerSchema = z.object({
  body: z.object({}).default({}),
  query: z.object({
    district: z.string().min(2).optional(),
    city: z.string().min(2).optional(),
    venueType: z.string().min(2).optional(),
    search: z.string().min(1).optional(),
    approvalStatus: z.enum(["pending", "active", "disabled"]).optional(),
    includeInactive: z
      .enum(["true", "false"])
      .optional()
      .transform((value) => (value ? value === "true" : undefined)),
    limit: z.coerce.number().int().min(1).max(200).optional(),
  }),
  params: z.object({}).default({}),
});

export const venueOwnerIdSchema = z.object({
  body: z.object({}).optional().default({}),
  query: z.object({}),
  params: z.object({
    venueOwnerId: z.string().min(1),
  }),
});
