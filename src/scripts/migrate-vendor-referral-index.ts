import mongoose from "mongoose";
import { env } from "../config/env";

type DuplicateRow = {
  _id: string;
  count: number;
};

async function run() {
  await mongoose.connect(env.MONGODB_URI);

  const vendors = mongoose.connection.collection("vendors");

  // Cleanup legacy placeholders so vendors without code are not indexed as duplicates.
  const cleanupResult = await vendors.updateMany(
    {
      $or: [{ referralCode: "" }, { referralCode: null }],
    },
    {
      $unset: {
        referralCode: "",
        referralCodeAssignedAt: "",
      },
    },
  );

  const duplicateRows = (await vendors
    .aggregate([
      {
        $match: {
          referralCode: {
            $type: "string",
            $ne: "",
          },
        },
      },
      {
        $group: {
          _id: "$referralCode",
          count: { $sum: 1 },
        },
      },
      {
        $match: {
          count: { $gt: 1 },
        },
      },
      {
        $sort: { count: -1, _id: 1 },
      },
      {
        $limit: 20,
      },
    ])
    .toArray()) as DuplicateRow[];

  if (duplicateRows.length > 0) {
    console.error("Duplicate non-empty referral codes found. Resolve these first:");
    for (const row of duplicateRows) {
      console.error(`REFERRAL_CODE=${row._id} COUNT=${row.count}`);
    }

    throw new Error("Migration halted due to duplicate non-empty referral codes.");
  }

  const indexes = await vendors.indexes();
  const existingReferralIndex = indexes.find((index) => index.name === "referralCode_1");

  if (existingReferralIndex) {
    await vendors.dropIndex("referralCode_1");
  }

  await vendors.createIndex(
    { referralCode: 1 },
    {
      name: "referralCode_1",
      unique: true,
      partialFilterExpression: {
        referralCode: { $type: "string", $ne: "" },
      },
      background: true,
    },
  );

  console.warn(`CLEANED_COUNT=${cleanupResult.modifiedCount}`);
  console.warn("INDEX_READY=referralCode_1");

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
