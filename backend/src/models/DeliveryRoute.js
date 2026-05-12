import mongoose from "mongoose";

export const RouteStatus = Object.freeze({
  PLANNED: "PLANNED",
  LOCKED: "LOCKED",
  FINALIZED: "FINALIZED"
});

export const StopStatus = Object.freeze({
  PENDING: "PENDING",
  IN_PROGRESS: "IN_PROGRESS",
  COMPLETED: "COMPLETED",
  FAILED: "FAILED"
});

const stopSchema = new mongoose.Schema(
  {
    StopIndex: { type: Number, required: true },
    CustomerCode: { type: String, required: true, trim: true, uppercase: true },
    Address: { type: String, trim: true, default: "" },
    Latitude: { type: Number, default: null },
    Longitude: { type: Number, default: null },
    OrderIDs: [{ type: mongoose.Schema.Types.ObjectId, ref: "SalesOrder" }],
    OrderCodes: [{ type: String, trim: true, uppercase: true }],
    PlannedArrivalTime: { type: String, default: "" },
    PlannedServiceTime: { type: Number, default: 0, min: 0 },
    StopStatus: { type: String, enum: Object.values(StopStatus), default: StopStatus.PENDING },
    EpodSignature: { type: String, default: "" }, // Base64 signature
    EpodImages: [{ type: String }], // Array of Base64 images
    FailureReason: { type: String, default: "" }
  },
  { _id: false }
);

const deliveryRouteSchema = new mongoose.Schema(
  {
    RoutePlanID: { type: mongoose.Schema.Types.ObjectId, ref: "RoutePlan", required: true, index: true },
    OrganizationID: { type: mongoose.Schema.Types.ObjectId, ref: "Organization", required: true, index: true },
    VehicleID: { type: mongoose.Schema.Types.ObjectId, ref: "Vehicle", required: true },
    VehicleCode: { type: String, trim: true, uppercase: true, default: "" },
    DriverID: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    DriverCode: { type: String, trim: true, default: "" },
    Shift: { type: String, enum: ["MORNING", "AFTERNOON", "FULL_DAY"], default: "MORNING" },
    IsOutsourced: { type: Boolean, default: false },
    ServiceID: { type: mongoose.Schema.Types.ObjectId, ref: "Service", default: null },
    ServiceCode: { type: String, trim: true, default: "" },
    EstimatedCost: { type: Number, default: 0, min: 0 },
    Status: { type: String, enum: Object.values(RouteStatus), default: RouteStatus.PLANNED, index: true },
    Stops: { type: [stopSchema], default: [] },
    TotalDistance: { type: Number, default: 0, min: 0 },
    TotalWeight: { type: Number, default: 0, min: 0 },
    TotalVolume: { type: Number, default: 0, min: 0 },
    Notes: { type: String, trim: true, default: "" }
  },
  { timestamps: true }
);

deliveryRouteSchema.index({ RoutePlanID: 1, VehicleID: 1 }, { unique: true });
deliveryRouteSchema.index({ RoutePlanID: 1, Status: 1 });

export const DeliveryRoute = mongoose.model("DeliveryRoute", deliveryRouteSchema);
