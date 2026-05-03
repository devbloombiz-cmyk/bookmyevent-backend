import { z } from "zod";

const legacyVenueTypeEnum = z.enum([
  "Auditorium & Convention Centres",
  "Banquet Halls",
  "Outdoor Venues",
  "Hotels & Resorts",
  "Conference / Meeting Halls",
  "AC hall",
]);

const canonicalVenueTypeEnum = z.enum(["AC_HALL", "NON_AC_HALL", "OUTDOOR", "RESORT", "HOTEL"]);
const canonicalPriceTypeEnum = z.enum(["PER_DAY", "PER_EVENT", "PER_PLATE"]);
const legacyPriceTypeEnum = z.enum(["per_day", "per_event", "per_plate"]);
const foodTypeEnum = z.enum(["SADYA", "VEG", "NON_VEG", "BUFFET", "CUSTOM"]);
const foodPriceTypeEnum = z.enum(["INCLUDED_IN_PACKAGE", "PRICE_PER_PLATE", "EXTRA_ADDON"]);

const toCanonicalPriceType = (value: string) => {
  if (value === "per_day") return "PER_DAY";
  if (value === "per_event") return "PER_EVENT";
  if (value === "per_plate") return "PER_PLATE";
  return value;
};

const serviceItemSchema = z.object({
  enabled: z.boolean().default(true),
  label: z.string().min(1),
  description: z.string().optional().default(""),
});

const customInclusionSchema = z.object({
  title: z.string().min(1),
  description: z.string().optional().default(""),
});

const additionalFoodOptionsSchema = z
  .object({
    minPlateCount: z.number().int().min(0).optional().default(0),
    maxPlateCount: z.number().int().min(0).optional().default(0),
    welcomeDrinkIncluded: z.boolean().optional().default(false),
    dessertIncluded: z.boolean().optional().default(false),
    customMenuAvailable: z.boolean().optional().default(false),
  })
  .superRefine((value, ctx) => {
    if (value.maxPlateCount > 0 && value.minPlateCount > value.maxPlateCount) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["minPlateCount"],
        message: "Minimum plate count cannot exceed maximum plate count.",
      });
    }
  });

const foodAndCateringSchema = z
  .object({
    foodIncluded: z.boolean().optional().default(false),
    foodPackageName: z.string().optional().default(""),
    foodType: foodTypeEnum.optional(),
    foodPriceType: foodPriceTypeEnum.optional(),
    pricePerPlate: z.number().min(0).optional().default(0),
    menuItems: z.array(z.string().min(1)).optional().default([]),
    additionalFoodOptions: additionalFoodOptionsSchema.optional().default(() => ({
      minPlateCount: 0,
      maxPlateCount: 0,
      welcomeDrinkIncluded: false,
      dessertIncluded: false,
      customMenuAvailable: false,
    })),
  })
  .superRefine((value, ctx) => {
    if (!value.foodIncluded) {
      return;
    }

    if (!value.foodPackageName.trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["foodPackageName"],
        message: "Food package name is required when food is enabled.",
      });
    }

    if (!value.foodType) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["foodType"],
        message: "Food type is required when food is enabled.",
      });
    }

    if (!value.foodPriceType) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["foodPriceType"],
        message: "Food price type is required when food is enabled.",
      });
    }

    if ((value.foodPriceType ?? "") === "PRICE_PER_PLATE" && (!value.pricePerPlate || value.pricePerPlate <= 0)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["pricePerPlate"],
        message: "Price per plate is required for PRICE_PER_PLATE.",
      });
    }

    if (!value.menuItems.length) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["menuItems"],
        message: "At least one menu item is required when food is enabled.",
      });
    }
  });

const venueFoodOptionSchema = z.object({
  packageName: z.string().min(1),
  foodTypes: z.array(z.string()).optional().default([]),
  priceType: z.enum(["included_in_package", "price_per_plate", "extra_addon"]).optional().default("included_in_package"),
  pricePerPlate: z.number().min(0).optional().default(0),
  addonPrice: z.number().min(0).optional().default(0),
  menuItems: z.array(z.string()).optional().default([]),
});

const venueFoodMenuSchema = z.object({
  name: z.string().min(1),
  includes: z.array(z.string()).optional().default([]),
});

const timeValueSchema = z
  .string()
  .optional()
  .default("")
  .refine((value) => !value || /^([01]\d|2[0-3]):([0-5]\d)$/.test(value), {
    message: "Time must be in HH:MM format.",
  });

const venuePackageSchema = z.object({
  packageName: z.string().min(1),
  basePrice: z.number().min(0).optional().default(0),
  price: z.number().min(0),
  priceType: z
    .union([canonicalPriceTypeEnum, legacyPriceTypeEnum])
    .optional()
    .default("PER_EVENT")
    .transform((value) => toCanonicalPriceType(value)),
  description: z.string().optional().default(""),
  descriptionHighlights: z.array(z.string().max(160)).optional().default([]),
  coverImage: z.string().optional().default(""),
  portfolioImages: z.array(z.string()).optional().default([]),
  videoLinks: z.array(z.url()).optional().default([]),
  venueStartTime: timeValueSchema,
  venueEndTime: timeValueSchema,
  inclusions: z.array(z.string()).optional().default([]),
  minGuestCapacity: z.number().int().min(0).optional().default(0),
  seatingCapacity: z.number().int().min(0).optional().default(0),
  maxGuestCapacity: z.number().int().min(0).optional().default(0),
  parkingVehicleCount: z.number().int().min(0).optional().default(0),
  roomsAvailableCount: z.number().int().min(0).optional().default(0),
  includedServices: z.array(z.string()).optional().default([]),
  includedServicesDetailed: z.array(serviceItemSchema).optional().default([]),
  additionalServices: z.array(z.string()).optional().default([]),
  foodAndCatering: foodAndCateringSchema.optional(),
  customInclusions: z.array(customInclusionSchema).optional().default([]),
  foodOptions: z.array(venueFoodOptionSchema).optional().default([]),
  foodMenus: z.array(venueFoodMenuSchema).optional().default([]),
  welcomeDrinkIncluded: z.boolean().optional().default(false),
  dessertIncluded: z.boolean().optional().default(false),
  customMenuAvailable: z.boolean().optional().default(false),
  isActive: z.boolean().optional().default(true),
}).superRefine((pkg, ctx) => {
  if (pkg.venueStartTime && pkg.venueEndTime && pkg.venueStartTime >= pkg.venueEndTime) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["venueEndTime"],
      message: "Venue end time must be later than start time.",
    });
  }

  if (pkg.maxGuestCapacity > 0 && pkg.minGuestCapacity > pkg.maxGuestCapacity) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["minGuestCapacity"],
      message: "Minimum guest capacity cannot exceed maximum guest capacity.",
    });
  }

  if (pkg.seatingCapacity > 0 && pkg.minGuestCapacity > pkg.seatingCapacity) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["minGuestCapacity"],
      message: "Minimum guest capacity cannot exceed seating capacity.",
    });
  }

  if (pkg.maxGuestCapacity > 0 && pkg.seatingCapacity > pkg.maxGuestCapacity) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["seatingCapacity"],
      message: "Seating capacity cannot exceed maximum guest capacity.",
    });
  }
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
    venueType: z.union([legacyVenueTypeEnum, canonicalVenueTypeEnum]).optional(),
    venueTypes: z.array(canonicalVenueTypeEnum).optional().default([]),
    guestCapacity: z
      .object({
        minGuests: z.number().int().min(0),
        maxGuests: z.number().int().min(0),
      })
      .optional(),
    parkingAvailable: z.boolean().optional().default(false),
    parkingCapacity: z.number().int().min(0).optional().default(0),
    roomsAvailable: z.boolean().optional().default(false),
    roomCount: z.number().int().min(0).optional().default(0),
    description: z.string().optional().default(""),
    approvalStatus: z.enum(["pending", "active", "disabled"]).optional().default("pending"),
    isActive: z.boolean().optional().default(true),
    profileImages: z.array(z.url()).optional().default([]),
    venuePackages: z.array(venuePackageSchema).optional().default([]),
  }).superRefine((payload, ctx) => {
    if (!payload.venueType && !payload.venueTypes.length) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["venueTypes"],
        message: "Either venueType or venueTypes is required.",
      });
    }

    if (payload.guestCapacity && payload.guestCapacity.maxGuests > 0 && payload.guestCapacity.minGuests > payload.guestCapacity.maxGuests) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["guestCapacity", "minGuests"],
        message: "Minimum guests cannot exceed maximum guests.",
      });
    }

    if (payload.parkingAvailable && (!payload.parkingCapacity || payload.parkingCapacity <= 0)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["parkingCapacity"],
        message: "Parking capacity is required when parking is enabled.",
      });
    }

    if (payload.roomsAvailable && (!payload.roomCount || payload.roomCount <= 0)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["roomCount"],
        message: "Room count is required when rooms are enabled.",
      });
    }
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
      venueType: z.union([legacyVenueTypeEnum, canonicalVenueTypeEnum]).optional(),
      venueTypes: z.array(canonicalVenueTypeEnum).optional(),
      guestCapacity: z
        .object({
          minGuests: z.number().int().min(0),
          maxGuests: z.number().int().min(0),
        })
        .optional(),
      parkingAvailable: z.boolean().optional(),
      parkingCapacity: z.number().int().min(0).optional(),
      roomsAvailable: z.boolean().optional(),
      roomCount: z.number().int().min(0).optional(),
      description: z.string().optional(),
      approvalStatus: z.enum(["pending", "active", "disabled"]).optional(),
      isActive: z.boolean().optional(),
      profileImages: z.array(z.url()).optional(),
      venuePackages: z.array(venuePackageSchema).optional(),
    })
    .refine((payload) => Object.keys(payload).length > 0, "At least one field is required")
    .superRefine((payload, ctx) => {
      if (payload.guestCapacity && payload.guestCapacity.maxGuests > 0 && payload.guestCapacity.minGuests > payload.guestCapacity.maxGuests) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["guestCapacity", "minGuests"],
          message: "Minimum guests cannot exceed maximum guests.",
        });
      }

      if (payload.parkingAvailable === true && (!payload.parkingCapacity || payload.parkingCapacity <= 0)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["parkingCapacity"],
          message: "Parking capacity is required when parking is enabled.",
        });
      }

      if (payload.roomsAvailable === true && (!payload.roomCount || payload.roomCount <= 0)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["roomCount"],
          message: "Room count is required when rooms are enabled.",
        });
      }
    }),
  query: z.object({}),
  params: z.object({
    venueOwnerId: z.string().min(1),
  }),
});

export const updateVenueOwnerSelfSchema = z.object({
  body: updateVenueOwnerSchema.shape.body,
  query: z.object({}),
  params: z.object({}).default({}),
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
