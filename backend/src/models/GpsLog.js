import mongoose from "mongoose";

const gpsLogSchema = new mongoose.Schema(
  {
    DriverID: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    RouteID: { type: mongoose.Schema.Types.ObjectId, ref: "DeliveryRoute" },
    OrganizationID: { type: mongoose.Schema.Types.ObjectId, ref: "Organization" },
    Latitude: { type: Number, required: true },
    Longitude: { type: Number, required: true },
    Speed: { type: Number, default: 0 },
    BatteryLevel: { type: Number },
    Timestamp: { type: Date, default: Date.now, index: true }
  },
  { timestamps: true }
);

export const GpsLog = mongoose.model("GpsLog", gpsLogSchema);
