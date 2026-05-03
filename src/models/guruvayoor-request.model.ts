import { Schema, model } from "mongoose";

const personDetailSchema = new Schema(
  {
    fullName: { type: String, required: true, trim: true },
    dateOfBirth: { type: Date, required: true },
    gender: { type: String, enum: ["male", "female", "other"], required: true },
    idProofType: {
      type: String,
      enum: ["aadhaar", "passport", "driving_license", "voter_id", "pan_card"],
      required: true,
    },
    idNumber: { type: String, required: true, trim: true },
  },
  { _id: false },
);

const guruvayoorRequestSchema = new Schema(
  {
    eventDate: { type: Date, required: true },
    timeSlot: { type: String, enum: ["05:00", "06:00", "07:00", "08:00", "09:00", "10:00"], required: true },
    groomDetails: { type: personDetailSchema, required: true },
    brideDetails: { type: personDetailSchema, required: true },
    addPhotographer: { type: Boolean, default: false },
    guestCount: { type: Number, required: true, min: 0, max: 8 },
    summary: { type: String, default: "", trim: true },
    status: { type: String, enum: ["pending", "approved", "rejected"], default: "pending" },
  },
  { timestamps: true },
);

guruvayoorRequestSchema.index({ status: 1, createdAt: -1 });
guruvayoorRequestSchema.index({ eventDate: 1, timeSlot: 1 });

export const GuruvayoorRequestModel = model("GuruvayoorRequest", guruvayoorRequestSchema);
