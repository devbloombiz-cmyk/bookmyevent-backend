import mongoose from "mongoose";
import { config } from "dotenv";
import { resolve } from "path";
import { VenueOwnerModel } from "../models/venue-owner.model";

config({ path: resolve(__dirname, "../../../.env") });

async function migrate() {
  try {
    const mongoUri = process.env.MONGODB_URI || "mongodb://localhost:27017/bookmyevent";
    await mongoose.connect(mongoUri);
    console.log("Connected to MongoDB.");

    const venues = await VenueOwnerModel.find({ "venuePackages.0": { $exists: true } });
    let updatedCount = 0;

    for (const venue of venues) {
      let needsSave = false;

      // venuePackages is a mongoose DocumentArray now, but let's iterate and ensure _id exists
      venue.venuePackages.forEach((pkg: any) => {
        if (!pkg._id) {
          pkg._id = new mongoose.Types.ObjectId();
          needsSave = true;
        }
      });

      if (needsSave) {
        // Mark modified in case Mongoose doesn't detect the deep change
        venue.markModified("venuePackages");
        await venue.save();
        updatedCount++;
      }
    }

    console.log(`Successfully migrated ${updatedCount} venues.`);
  } catch (error) {
    console.error("Migration failed:", error);
  } finally {
    await mongoose.disconnect();
    console.log("Disconnected from MongoDB.");
  }
}

migrate();
