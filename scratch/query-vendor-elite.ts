import { connectToDatabase } from "../src/config/database";
import { vendorService } from "../src/services/vendor.service";
import mongoose from "mongoose";

async function main() {
  await connectToDatabase();
  console.log("Connected. Querying vendor 6a48c18db8bc0bbba2de3a88...");

  const vendor = await vendorService.getVendorById("6a48c18db8bc0bbba2de3a88");
  console.log("Vendor details:", vendor);

  mongoose.connection.close();
}

main().catch((err) => {
  console.error(err);
  mongoose.connection.close();
});
