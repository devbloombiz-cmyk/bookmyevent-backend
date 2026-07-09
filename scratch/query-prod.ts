import mongoose from "mongoose";
import { GalleryModel } from "../src/models/gallery.model";
import { VendorModel } from "../src/models/vendor.model";
import { AccountSubscriptionModel } from "../src/models/account-subscription.model";

const PROD_URI =
  "mongodb+srv://udeeshbhanuu_db_user:RdGBDUc1PhfuBHMF@evanza-prod-cluster.eqimy0z.mongodb.net/bookmyevent?retryWrites=true&w=majority";

async function main() {
  console.log("Connecting to production MongoDB...");
  await mongoose.connect(PROD_URI);
  console.log("Connected successfully!");

  // 1. Get all active PRO subscriptions
  const subscriptions = await AccountSubscriptionModel.find({
    status: "active",
    paymentStatus: "confirmed",
  });
  console.log(`Found ${subscriptions.length} active subscriptions`);
  for (const sub of subscriptions) {
    console.log(
      `Sub: actorType=${sub.actorType}, actorId=${sub.actorId}, planCode=${sub.planCode}, endsAt=${sub.endsAt}`,
    );
  }

  // 2. Find vendors that have videoLinks
  const vendors = await VendorModel.find({
    videoLinks: { $exists: true, $not: { $size: 0 } },
  });
  console.log(`Found ${vendors.length} vendors with videoLinks in DB`);
  for (const v of vendors) {
    console.log(`Vendor: ID=${v._id}, name=${v.businessName}, videoLinks=`, v.videoLinks);
  }

  // 3. Find video items in gallery
  const galleryVideos = await GalleryModel.find({
    mediaType: "video",
  });
  console.log(`Found ${galleryVideos.length} video gallery items in DB`);
  for (const item of galleryVideos) {
    console.log(
      `GalleryItem: ID=${item._id}, vendorId=${item.vendorId}, mediaUrl=${item.mediaUrl}, embedUrl=${item.embedUrl}, platform=${item.videoPlatform}`,
    );
  }

  await mongoose.connection.close();
}

main().catch((err) => {
  console.error("Error:", err);
  mongoose.connection.close();
});
