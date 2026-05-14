/*
  PaymentRequest index migration (mongosh)
  Purpose:
  - Remove legacy unique+sparse indexes for Razorpay fields.
  - Clean empty-string values that can block retries.
  - Create safe partial unique indexes used by current backend code.

  Run:
  mongosh "mongodb://<host>:<port>/<dbName>" --file backend/src/scripts/payment-request-index-migration.mongosh.js

  Notes:
  - Set DRY_RUN = true first to preview changes.
  - Run during low traffic window.
*/

const DRY_RUN = false;
const COLLECTION = "paymentrequests";

function logTitle(title) {
  print("\n============================================================");
  print(title);
  print("============================================================");
}

function keysMatch(indexKey, expected) {
  const a = Object.keys(indexKey || {});
  const b = Object.keys(expected || {});
  if (a.length !== b.length) return false;
  for (const k of b) {
    if (!(k in indexKey)) return false;
    if (indexKey[k] !== expected[k]) return false;
  }
  return true;
}

function findIndexesByKey(indexes, keyPattern) {
  return indexes.filter((idx) => keysMatch(idx.key, keyPattern));
}

(function run() {
  logTitle("PaymentRequest Index Migration Started");

  const existingCollections = db.getCollectionNames();
  if (!existingCollections.includes(COLLECTION)) {
    print(`Collection '${COLLECTION}' not found in DB '${db.getName()}'. Aborting.`);
    quit(1);
  }

  const col = db.getCollection(COLLECTION);

  const beforeIndexes = col.getIndexes();
  print("Current indexes:");
  printjson(beforeIndexes);

  const targetKeys = [
    { razorpayPaymentLinkId: 1 },
    { razorpayPaymentId: 1 },
    { razorpayReferenceId: 1 },
  ];

  logTitle("Step 1: Drop existing indexes on target keys");
  for (const key of targetKeys) {
    const matches = findIndexesByKey(beforeIndexes, key);
    if (!matches.length) {
      print(`No existing index found for key: ${tojson(key)}`);
      continue;
    }

    for (const idx of matches) {
      print(`Found index '${idx.name}' for key ${tojson(key)} (unique=${!!idx.unique}, sparse=${!!idx.sparse})`);
      if (!DRY_RUN) {
        const dropResult = col.dropIndex(idx.name);
        print(`Dropped index '${idx.name}': ${tojson(dropResult)}`);
      }
    }
  }

  logTitle("Step 2: Cleanup empty string Razorpay fields");
  const cleanupFilter = {
    $or: [
      { razorpayPaymentLinkId: "" },
      { razorpayPaymentId: "" },
      { razorpayReferenceId: "" },
      { paymentLinkUrl: "" },
      { webhookEventId: "" },
    ],
  };

  const cleanupUpdate = {
    $unset: {
      razorpayPaymentLinkId: "",
      razorpayPaymentId: "",
      razorpayReferenceId: "",
      paymentLinkUrl: "",
      webhookEventId: "",
    },
  };

  const affected = col.countDocuments(cleanupFilter);
  print(`Documents matching cleanup filter: ${affected}`);
  if (!DRY_RUN && affected > 0) {
    const updateResult = col.updateMany(cleanupFilter, cleanupUpdate);
    print("Cleanup update result:");
    printjson(updateResult);
  }

  logTitle("Step 3: Create partial unique indexes");
  const indexSpecs = [
    {
      key: { razorpayPaymentLinkId: 1 },
      options: {
        name: "uniq_razorpayPaymentLinkId_nonempty",
        unique: true,
        partialFilterExpression: {
          razorpayPaymentLinkId: { $exists: true, $type: "string", $ne: "" },
        },
      },
    },
    {
      key: { razorpayPaymentId: 1 },
      options: {
        name: "uniq_razorpayPaymentId_nonempty",
        unique: true,
        partialFilterExpression: {
          razorpayPaymentId: { $exists: true, $type: "string", $ne: "" },
        },
      },
    },
    {
      key: { razorpayReferenceId: 1 },
      options: {
        name: "uniq_razorpayReferenceId_nonempty",
        unique: true,
        partialFilterExpression: {
          razorpayReferenceId: { $exists: true, $type: "string", $ne: "" },
        },
      },
    },
  ];

  for (const spec of indexSpecs) {
    print(`Ensuring index ${spec.options.name}`);
    if (!DRY_RUN) {
      const createdName = col.createIndex(spec.key, spec.options);
      print(`Created/confirmed index: ${createdName}`);
    }
  }

  logTitle("Step 4: Post-migration verification");
  const afterIndexes = col.getIndexes();
  print("Indexes after migration:");
  printjson(afterIndexes);

  const requiredNames = [
    "uniq_razorpayPaymentLinkId_nonempty",
    "uniq_razorpayPaymentId_nonempty",
    "uniq_razorpayReferenceId_nonempty",
  ];

  const missing = requiredNames.filter((name) => !afterIndexes.some((idx) => idx.name === name));
  if (missing.length) {
    print(`ERROR: Missing required indexes: ${missing.join(", ")}`);
    quit(2);
  }

  print("\nMigration completed successfully.");
})();
