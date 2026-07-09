import { connectToDatabase } from "../src/config/database";
import { GalleryModel } from "../src/models/gallery.model";
import mongoose from "mongoose";

async function main() {
  await connectToDatabase();
  console.log("Connected. Querying gallery for vendor 6a48c18db8bc0bbba2de3a88...");

  const items = await GalleryModel.find({ vendorId: "6a48c18db8bc0bbba2de3a88" });
  console.log("Gallery items count:", items.length);
  console.log("Gallery items:", JSON.stringify(items, null, 2));

  mongoose.connection.close();
}

main().catch((err) => {
  console.error(err);
  mongoose.connection.close();
});
