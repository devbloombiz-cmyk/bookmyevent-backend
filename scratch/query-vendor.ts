/* eslint-disable no-console */
import { connectToDatabase } from "../src/config/database";
import { vendorService } from "../src/services/vendor.service";
import mongoose from "mongoose";

async function main() {
  await connectToDatabase();
  console.log("Connected to database. Querying vendor...");
  const vendorId = "6a3d55a1ba76cce5e94a06ca";

  const serviceResult = await vendorService.getVendorById(vendorId);
  console.log("Service-retrieved vendor details:", serviceResult);

  mongoose.connection.close();
}

main().catch((err) => {
  console.error(err);
  mongoose.connection.close();
});
