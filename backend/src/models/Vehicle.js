import mongoose from "mongoose";

export const VehicleType = Object.freeze({
  TRUCK:      "TRUCK",
  SEMI_TRUCK: "SEMI_TRUCK",
  TRAILER:    "TRAILER",
  BIKE:       "BIKE"
});

export const VehicleEmploymentType = Object.freeze({
  IN_HOUSE:   "IN_HOUSE",   // xe nội bộ — tham gia lịch bảo dưỡng nội bộ
  OUTSOURCED: "OUTSOURCED"  // xe 3PL — chi phí tính theo Service, không bảo dưỡng nội bộ
});

const vehicleSchema = new mongoose.Schema(
  {
    VehicleCode: { type: String, required: true, trim: true, uppercase: true },
    XName: { type: String, required: true, trim: true },
    OrganizationID: { type: mongoose.Schema.Types.ObjectId, ref: "Organization", required: true, index: true },
    LicensePlate: { type: String, trim: true, uppercase: true, default: "" },
    VehicleType: { type: String, enum: Object.values(VehicleType), default: VehicleType.TRUCK },
    EmploymentType: {
      type: String,
      enum: Object.values(VehicleEmploymentType),
      default: VehicleEmploymentType.IN_HOUSE,
      index: true
    },
    // Hãng 3PL sở hữu xe — bắt buộc khi EmploymentType=OUTSOURCED
    ServiceID: { type: mongoose.Schema.Types.ObjectId, ref: "Service", default: null, index: true },
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
// Filter list theo loại 3PL/IN_HOUSE + Active — query phổ biến nhất trên trang Vehicles
vehicleSchema.index({ OrganizationID: 1, EmploymentType: 1, Status: 1 });

export const Vehicle = mongoose.model("Vehicle", vehicleSchema);
