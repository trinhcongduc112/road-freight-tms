import mongoose from "mongoose";

const VEHICLE_TYPES = ["TRUCK", "SEMI_TRUCK", "TRAILER", "BIKE"];

const driverSchema = new mongoose.Schema(
  {
    DriverCode:  { type: String, required: true, trim: true, uppercase: true },
    XName:       { type: String, required: true, trim: true },
    OrganizationID: { type: mongoose.Schema.Types.ObjectId, ref: "Organization", required: true, index: true },
    Phone:       { type: String, trim: true, default: "" },
    Email:       { type: String, trim: true, lowercase: true, default: "" },
    VehicleType: { type: String, enum: VEHICLE_TYPES, default: null },
    LinkedUserID: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    Status:      { type: String, enum: ["Active", "Inactive"], default: "Active", index: true },
    CreatedBy:   { type: mongoose.Schema.Types.ObjectId, ref: "User" }
  },
  { timestamps: true }
);

driverSchema.index({ OrganizationID: 1, DriverCode: 1 }, { unique: true });

export const Driver = mongoose.model("Driver", driverSchema);
