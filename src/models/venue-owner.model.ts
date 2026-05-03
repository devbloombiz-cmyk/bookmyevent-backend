import { Schema, model } from "mongoose";

const includedServiceItemSchema = new Schema(
  {
    enabled: { type: Boolean, default: true },
    label: { type: String, required: true, trim: true },
    description: { type: String, default: "", trim: true },
  },
  { _id: false },
);

const additionalFoodOptionsSchema = new Schema(
  {
    minPlateCount: { type: Number, default: 0, min: 0 },
    maxPlateCount: { type: Number, default: 0, min: 0 },
    welcomeDrinkIncluded: { type: Boolean, default: false },
    dessertIncluded: { type: Boolean, default: false },
    customMenuAvailable: { type: Boolean, default: false },
  },
  { _id: false },
);

const foodAndCateringSchema = new Schema(
  {
    foodIncluded: { type: Boolean, default: false },
    foodPackageName: { type: String, default: "", trim: true },
    foodType: {
      type: String,
      enum: ["SADYA", "VEG", "NON_VEG", "BUFFET", "CUSTOM"],
      default: "CUSTOM",
    },
    foodPriceType: {
      type: String,
      enum: ["INCLUDED_IN_PACKAGE", "PRICE_PER_PLATE", "EXTRA_ADDON"],
      default: "INCLUDED_IN_PACKAGE",
    },
    pricePerPlate: { type: Number, default: 0, min: 0 },
    menuItems: { type: [String], default: [] },
    additionalFoodOptions: { type: additionalFoodOptionsSchema, default: () => ({}) },
  },
  { _id: false },
);

const customInclusionItemSchema = new Schema(
  {
    title: { type: String, required: true, trim: true },
    description: { type: String, default: "", trim: true },
  },
  { _id: false },
);

const venueFoodOptionSchema = new Schema(
  {
    packageName: { type: String, required: true, trim: true },
    foodTypes: { type: [String], default: [] },
    priceType: {
      type: String,
      enum: ["included_in_package", "price_per_plate", "extra_addon"],
      default: "included_in_package",
    },
    pricePerPlate: { type: Number, default: 0, min: 0 },
    addonPrice: { type: Number, default: 0, min: 0 },
    menuItems: { type: [String], default: [] },
  },
  { _id: false },
);

const venueFoodMenuSchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    includes: { type: [String], default: [] },
  },
  { _id: false },
);

const venuePackageSchema = new Schema(
  {
    packageName: { type: String, required: true, trim: true },
    basePrice: { type: Number, default: 0, min: 0 },
    price: { type: Number, required: true, min: 0 },
    priceType: {
      type: String,
      enum: ["PER_DAY", "PER_EVENT", "PER_PLATE", "per_day", "per_event", "per_plate"],
      default: "PER_EVENT",
    },
    description: { type: String, default: "", trim: true },
    descriptionHighlights: { type: [String], default: [] },
    coverImage: { type: String, default: "", trim: true },
    portfolioImages: { type: [String], default: [] },
    videoLinks: { type: [String], default: [] },
    venueStartTime: { type: String, default: "", trim: true },
    venueEndTime: { type: String, default: "", trim: true },
    inclusions: { type: [String], default: [] },
    minGuestCapacity: { type: Number, default: 0, min: 0 },
    seatingCapacity: { type: Number, default: 0, min: 0 },
    maxGuestCapacity: { type: Number, default: 0, min: 0 },
    parkingVehicleCount: { type: Number, default: 0, min: 0 },
    roomsAvailableCount: { type: Number, default: 0, min: 0 },
    includedServices: { type: [String], default: [] },
    includedServicesDetailed: { type: [includedServiceItemSchema], default: [] },
    additionalServices: { type: [String], default: [] },
    foodAndCatering: { type: foodAndCateringSchema, default: () => ({}) },
    customInclusions: { type: [customInclusionItemSchema], default: [] },
    foodOptions: { type: [venueFoodOptionSchema], default: [] },
    foodMenus: { type: [venueFoodMenuSchema], default: [] },
    welcomeDrinkIncluded: { type: Boolean, default: false },
    dessertIncluded: { type: Boolean, default: false },
    customMenuAvailable: { type: Boolean, default: false },
    isActive: { type: Boolean, default: true },
  },
  { _id: false },
);

const venueOwnerSchema = new Schema(
  {
    businessName: { type: String, required: true, trim: true },
    ownerName: { type: String, required: true, trim: true },
    email: { type: String, required: true, trim: true, lowercase: true },
    mobile: { type: String, required: true, trim: true },
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      index: true,
      sparse: true,
    },
    state: { type: String, default: "", trim: true },
    district: { type: String, default: "", trim: true },
    city: { type: String, required: true, trim: true },
    locationDisplayName: { type: String, default: "", trim: true },
    addressLine: { type: String, default: "", trim: true },
    venueType: {
      type: String,
      enum: [
        "Auditorium & Convention Centres",
        "Banquet Halls",
        "Outdoor Venues",
        "Hotels & Resorts",
        "Conference / Meeting Halls",
        "AC hall",
        "AC_HALL",
        "NON_AC_HALL",
        "OUTDOOR",
        "RESORT",
        "HOTEL",
      ],
      required: true,
    },
    venueTypes: {
      type: [String],
      enum: ["AC_HALL", "NON_AC_HALL", "OUTDOOR", "RESORT", "HOTEL"],
      default: [],
    },
    guestCapacity: {
      minGuests: { type: Number, default: 0, min: 0 },
      maxGuests: { type: Number, default: 0, min: 0 },
    },
    parkingAvailable: { type: Boolean, default: false },
    parkingCapacity: { type: Number, default: 0, min: 0 },
    roomsAvailable: { type: Boolean, default: false },
    roomCount: { type: Number, default: 0, min: 0 },
    description: { type: String, default: "" },
    registrationSource: { type: String, enum: ["admin", "public"], default: "public" },
    approvalStatus: { type: String, enum: ["pending", "active", "disabled"], default: "pending" },
    isActive: { type: Boolean, default: true },
    linkedVendorId: { type: Schema.Types.ObjectId, ref: "Vendor", default: null },
    profileImages: { type: [String], default: [] },
    venuePackages: { type: [venuePackageSchema], default: [] },
  },
  { timestamps: true },
);

venueOwnerSchema.index({ approvalStatus: 1, isActive: 1 });
venueOwnerSchema.index({ city: 1, district: 1, state: 1 });
venueOwnerSchema.index({ venueType: 1 });
venueOwnerSchema.index({ email: 1 });
venueOwnerSchema.index({ mobile: 1 });
venueOwnerSchema.index({ businessName: 1 });

export const VenueOwnerModel = model("VenueOwner", venueOwnerSchema);
