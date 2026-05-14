import { Schema, model } from "mongoose";

const reviewSchema = new Schema(
  {
    bookingId: { type: Schema.Types.ObjectId, ref: "Booking", required: true, unique: true },
    customerId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    customerName: { type: String, default: "Verified User", trim: true },
    subjectType: { type: String, enum: ["vendor", "venue_owner"], required: true },
    subjectId: { type: Schema.Types.ObjectId, required: true },
    vendorId: { type: Schema.Types.ObjectId, ref: "Vendor", default: null },
    venueOwnerId: { type: Schema.Types.ObjectId, ref: "VenueOwner", default: null },
    rating: { type: Number, required: true, min: 1, max: 5 },
    title: { type: String, required: true, trim: true },
    message: { type: String, required: true, trim: true },
    isVerifiedBooking: { type: Boolean, default: true },
    helpfulCount: { type: Number, default: 0, min: 0 },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true },
);

reviewSchema.index({ subjectType: 1, subjectId: 1, createdAt: -1 });
reviewSchema.index({ customerId: 1, createdAt: -1 });
reviewSchema.index({ bookingId: 1 }, { unique: true });
reviewSchema.index({ rating: 1 });

export const ReviewModel = model("Review", reviewSchema);
