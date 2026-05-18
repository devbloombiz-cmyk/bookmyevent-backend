import mongoose from "mongoose";
import { env } from "../config/env";

function normalizeMobile(value: string) {
  const digits = String(value || "").replace(/\D/g, "");
  return digits.length >= 10 ? digits : "";
}

function extractField(message: string, label: string) {
  const aliases: Record<string, string[]> = {
    customer: ["Customer Name", "Name"],
    mobile: ["Mobile Number", "Contact", "Contact Number", "Phone", "Phone Number", "WhatsApp"],
    email: ["Email Address", "Mail"],
  };

  const candidates = [label, ...(aliases[label.toLowerCase()] || [])];
  for (const candidate of candidates) {
    const escaped = candidate.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const regex = new RegExp(`(?:^|\\n)\\s*${escaped}\\s*:\\s*([^\\n\\r]+)`, "i");
    const value = String(message || "").match(regex)?.[1]?.trim();
    if (value) {
      return value;
    }
  }

  return "";
}

async function run() {
  await mongoose.connect(env.MONGODB_URI);

  const Booking = mongoose.connection.collection("bookings");
  const Lead = mongoose.connection.collection("leads");
  const User = mongoose.connection.collection("users");

  const bookings = await Booking.find({}).toArray();
  let updatedCount = 0;

  for (const booking of bookings) {
    const lead = booking.leadId ? await Lead.findOne({ _id: booking.leadId }) : null;
    const customer = booking.customerId ? await User.findOne({ _id: booking.customerId }) : null;

    const customerName =
      String(booking.customerName || "").trim() ||
      String(customer?.name || "").trim() ||
      String(lead?.customerName || "").trim() ||
      extractField(String(lead?.message || ""), "Customer") ||
      "Customer";

    const customerMobile =
      normalizeMobile(String(booking.customerMobile || "")) ||
      normalizeMobile(String(customer?.mobile || "")) ||
      normalizeMobile(String(lead?.customerMobile || "")) ||
      normalizeMobile(extractField(String(lead?.message || ""), "Mobile"));

    const customerEmail =
      String(booking.customerEmail || "").trim() ||
      String(customer?.email || "").trim() ||
      String(lead?.customerEmail || "").trim() ||
      extractField(String(lead?.message || ""), "Email");

    const changed =
      String(booking.customerName || "").trim() !== customerName ||
      String(booking.customerMobile || "").trim() !== customerMobile ||
      String(booking.customerEmail || "").trim() !== customerEmail;

    if (!changed) {
      continue;
    }

    await Booking.updateOne(
      { _id: booking._id },
      {
        $set: {
          customerName,
          customerMobile,
          customerEmail,
        },
      },
    );

    updatedCount += 1;
  }

  console.log(`BOOKINGS_SCANNED=${bookings.length}`);
  console.log(`BOOKINGS_UPDATED=${updatedCount}`);

  await mongoose.disconnect();
}

run().catch(async (error) => {
  console.error(error);
  try {
    await mongoose.disconnect();
  } catch {
    // no-op
  }
  process.exit(1);
});
