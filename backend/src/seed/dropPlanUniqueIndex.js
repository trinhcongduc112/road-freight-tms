/**
 * One-time migration: drop the unique compound index on RoutePlan (OrganizationID + PlanDate)
 * Run once: node src/seed/dropPlanUniqueIndex.js
 */
import mongoose from "mongoose";
import dotenv from "dotenv";
dotenv.config();

const MONGO_URI = process.env.MONGO_URI || "mongodb://localhost:27017/road-freight";

await mongoose.connect(MONGO_URI);
const col = mongoose.connection.collection("routeplans");

try {
  await col.dropIndex("OrganizationID_1_PlanDate_1");
  console.log("✅ Dropped unique index OrganizationID_1_PlanDate_1");
} catch (e) {
  console.log("ℹ️  Index may already be dropped or renamed:", e.message);
}

await mongoose.disconnect();
console.log("Done.");
