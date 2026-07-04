import dotenv from "dotenv";
import { connectToDatabase } from "../config/database";
import mongoose from "mongoose";

dotenv.config();

async function run() {
  await connectToDatabase();

  const db = mongoose.connection.db!;

  // Find venue owners
  const venueOwners = await db.collection("venueowners").find({}).toArray();
  console.log("--- Venue Owners ---");
  for (const vo of venueOwners) {
    console.log(
      `ID: ${vo._id}, Name: ${vo.businessName || vo.name}, Email: ${vo.email}, userId: ${vo.userId}`,
    );
    console.log(`Venue Packages length: ${vo.venuePackages?.length || 0}`);
    console.log(`Profile Images length: ${vo.profileImages?.length || 0}`);
  }

  // Find subscription plans
  const plans = await db.collection("subscriptionplans").find({}).toArray();
  console.log("\n--- Subscription Plans ---");
  for (const p of plans) {
    console.log(`Code: ${p.code}, Name: ${p.name}, Limits:`, p.limits);
  }

  // Find account subscriptions
  const subs = await db.collection("accountsubscriptions").find({}).toArray();
  console.log("\n--- Account Subscriptions ---");
  for (const s of subs) {
    console.log(
      `ID: ${s._id}, ActorType: ${s.actorType}, ActorId: ${s.actorId}, PlanCode: ${s.planCode}, Status: ${s.status}, PaymentStatus: ${s.paymentStatus}, EndsAt: ${s.endsAt}`,
    );
  }

  process.exit(0);
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
