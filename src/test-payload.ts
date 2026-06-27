/* eslint-disable no-console */
import { createVenueOwnerSchema } from "./validators/venue-owner.validator";

const payload = {
  businessName: "test name ",
  ownerName: "test owner",
  email: "test123@gmail.com",
  mobile: "9834787499",
  venueType: "Wedding Halls",
  guestCapacity: {
    minGuests: 50,
    maxGuests: 200,
  },
  parkingAvailable: true,
  parkingCapacity: 98,
  roomsAvailable: false,
  roomCount: 0,
  description: "",
  locationInputMode: "manual",
  state: "Kerala",
  district: "Ernakulam",
  city: "test city",
  addressLine: "",
  locationDisplayName: "test city, Ernakulam, Kerala",
  profileImages: [],
  venuePackages: [],
  approvalStatus: "pending",
  isActive: true,
};

const result = createVenueOwnerSchema.safeParse({ body: payload, query: {}, params: {} });
if (!result.success) {
  console.log(JSON.stringify(result.error.issues, null, 2));
} else {
  console.log("Success!");
}
