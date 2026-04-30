import { z } from "zod";

const personDetailSchema = z.object({
  fullName: z.string().min(2),
  dateOfBirth: z.coerce.date(),
  gender: z.enum(["male", "female", "other"]),
  idProofType: z.enum(["aadhaar", "passport", "driving_license", "voter_id", "other"]),
  idNumber: z.string().min(4),
});

export const createGuruvayoorRequestSchema = z.object({
  body: z.object({
    eventDate: z.coerce.date(),
    timeSlot: z.enum(["05:00", "06:00", "07:00", "08:00", "09:00", "10:00"]),
    groomDetails: personDetailSchema,
    brideDetails: personDetailSchema,
    addPhotographer: z.boolean().optional().default(false),
    guestCount: z.number().int().min(0).max(8),
    summary: z.string().optional().default(""),
  }),
  query: z.object({}),
  params: z.object({}),
});

export const listGuruvayoorRequestSchema = z.object({
  body: z.object({}).default({}),
  query: z.object({
    status: z.enum(["pending", "approved", "rejected"]).optional(),
  }),
  params: z.object({}).default({}),
});

export const updateGuruvayoorRequestSchema = z.object({
  body: z
    .object({
      status: z.enum(["pending", "approved", "rejected"]).optional(),
      summary: z.string().optional(),
    })
    .refine((payload) => Object.keys(payload).length > 0, "At least one field is required"),
  query: z.object({}),
  params: z.object({
    requestId: z.string().min(1),
  }),
});
