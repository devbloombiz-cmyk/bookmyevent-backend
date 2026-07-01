/* eslint-disable no-console */
import mongoose from "mongoose";
import { env } from "../config/env";

async function run() {
  await mongoose.connect(env.MONGODB_URI);

  const GuruvayoorRequest = mongoose.connection.collection("guruvayoorrequests");

  const requests = await GuruvayoorRequest.find({
    $or: [{ contact: { $exists: false } }, { contact: null }, { contact: "" }],
  }).toArray();

  let updatedCount = 0;

  for (const request of requests) {
    // If contact is missing, update it to a default placeholder value
    await GuruvayoorRequest.updateOne(
      { _id: request._id },
      {
        $set: {
          contact: "9999999999",
        },
      },
    );
    updatedCount += 1;
  }

  console.log(`GURUVAYOOR_REQUESTS_SCANNED=${requests.length}`);
  console.log(`GURUVAYOOR_REQUESTS_UPDATED=${updatedCount}`);

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
