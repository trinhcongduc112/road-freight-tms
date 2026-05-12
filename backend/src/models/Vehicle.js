import mongoose from "mongoose";

export const VehicleType = Object.freeze({
  TRUCK:      "TRUCK",
  SEMI_TRUCK: "SEMI_TRUCK",
  TRAILER:    "TRAILER",
  BIKE:       "BIKE"
});

const vehicleSchema = new mongoose.Schema(
  {
    VehicleCode: { type: String, required: true, trim: true, uppercase: true },
    XName: { type: String, required: true, trim: true },
    OrganizationID: { type: mongoose.Schema.Types.ObjectId, ref: "Organization", required: true, index: true },
    LicensePlate: { type: String, trim: true, uppercase: true, default: "" },
    VehicleType: { type: String, enum: Object.values(VehicleType), default: VehicleType.TRUCK },
    Capabilities: { type: [String], default: [] },
    MaxWeight: { type: Number, default: 0, min: 0 },
    MaxVolume: { type: Number, default: 0, min: 0 },
    MaxCases: { type: Number, default: 0, min: 0 },
    FixedCost: { type: Number, default: 0, min: 0 },
    CostPerKm: { type: Number, default: 0, min: 0 },
    AvgSpeedKmh: { type: Number, default: 40, min: 1 },
    LoadingTime: { type: Number, default: 30, min: 0 },
    UnloadingTimePerStop: { type: Number, default: 15, min: 0 },
    Status: { type: String, enum: ["Active", "Inactive"], default: "Active", index: true },
    CreatedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" }
  },
  { timestamps: true }
);

vehicleSchema.index({ OrganizationID: 1, VehicleCode: 1 }, { unique: true });

export const Vehicle = mongoose.model("Vehicle", vehicleSchema);
