import mongoose from "mongoose";

const VEHICLE_TYPES = ["TRUCK", "SEMI_TRUCK", "TRAILER", "BIKE"];

export const EmploymentType = Object.freeze({
  IN_HOUSE:   "IN_HOUSE",   // tài xế nội bộ — hưởng lương + tham gia bảo dưỡng
  OUTSOURCED: "OUTSOURCED"  // tài xế 3PL — không nhận lương từ shipper, chi phí tính theo Service
});

const driverSchema = new mongoose.Schema(
  {
    DriverCode:  { type: String, required: true, trim: true, uppercase: true },
    XName:       { type: String, required: true, trim: true },
    OrganizationID: { type: mongoose.Schema.Types.ObjectId, ref: "Organization", required: true, index: true },
    Phone:       { type: String, trim: true, default: "" },
    Email:       { type: String, trim: true, lowercase: true, default: "" },
    VehicleType: { type: String, enum: VEHICLE_TYPES, default: null },
    LinkedUserID: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    EmploymentType: {
      type: String,
      enum: Object.values(EmploymentType),
      default: EmploymentType.IN_HOUSE,
      index: true
    },
    // Hãng 3PL (Service master-data) — bắt buộc khi EmploymentType=OUTSOURCED
    ServiceID:   { type: mongoose.Schema.Types.ObjectId, ref: "Service", default: null, index: true },
    Status:      { type: String, enum: ["Active", "Inactive"], default: "Active", index: true },
    CreatedBy:   { type: mongoose.Schema.Types.ObjectId, ref: "User" }
  },
  { timestamps: true }
);

driverSchema.index({ OrganizationID: 1, DriverCode: 1 }, { unique: true });
// Filter list theo loại 3PL/IN_HOUSE + Active — query phổ biến nhất trên trang Drivers
driverSchema.index({ OrganizationID: 1, EmploymentType: 1, Status: 1 });

export const Driver = mongoose.model("Driver", driverSchema);
