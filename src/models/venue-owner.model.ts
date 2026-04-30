import { Schema, model } from "mongoose";

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

const venuePackageSchema = new Schema(
  {
    packageName: { type: String, required: true, trim: true },
    price: { type: Number, required: true, min: 0 },
    priceType: { type: String, enum: ["per_day", "per_event", "per_plate"], default: "per_event" },
    description: { type: String, default: "", trim: true },
    inclusions: { type: [String], default: [] },
    minGuestCapacity: { type: Number, default: 0, min: 0 },
    maxGuestCapacity: { type: Number, default: 0, min: 0 },
    parkingVehicleCount: { type: Number, default: 0, min: 0 },
    roomsAvailableCount: { type: Number, default: 0, min: 0 },
    includedServices: { type: [String], default: [] },
    additionalServices: { type: [String], default: [] },
    foodOptions: { type: [venueFoodOptionSchema], default: [] },
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
      ],
      required: true,
    },
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
