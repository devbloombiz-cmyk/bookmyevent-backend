import { connectToDatabase } from "../src/config/database";
import { GalleryModel } from "../src/models/gallery.model";
import mongoose from "mongoose";

async function main() {
  await connectToDatabase();
  console.log("Connected. Fetching all video gallery items...");

  const items = await GalleryModel.find({ mediaType: "video" });
  console.log(`Found ${items.length} items:`);
  for (const item of items) {
    console.log({
      _id: item._id,
      title: item.title,
      category: item.category,
      subCategory: item.subCategory,
      mediaType: item.mediaType,
      mediaUrl: item.mediaUrl,
      embedUrl: item.embedUrl,
      videoPlatform: item.videoPlatform,
      vendorId: item.vendorId,
      isActive: item.isActive,
    });
  }

  mongoose.connection.close();
}

main().catch((err) => {
  console.error(err);
  mongoose.connection.close();
});
