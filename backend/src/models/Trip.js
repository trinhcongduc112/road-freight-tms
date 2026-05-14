import mongoose from "mongoose";

export const TripStatus = Object.freeze({
  ASSIGNED: "ASSIGNED",
  DRIVER_CONFIRMED: "DRIVER_CONFIRMED",
  LOADING: "LOADING",
  IN_PROGRESS: "IN_PROGRESS",
  RETURNING: "RETURNING",
  COMPLETED: "COMPLETED",
  CANCELLED: "CANCELLED"
});

export const TripTaskStatus = Object.freeze({
  PENDING: "PENDING",
  EN_ROUTE: "EN_ROUTE",
  ARRIVED: "ARRIVED",
  COMPLETED: "COMPLETED",
  FAILED: "FAILED"
});

const tripTaskSchema = new mongoose.Schema(
  {
    StopIndex: { type: Number, required: true },
    CustomerCode: { type: String, trim: true, uppercase: true, default: "" },
    CustomerName: { type: String, trim: true, default: "" },
    Address: { type: String, trim: true, default: "" },
    Latitude: { type: Number, default: null },
    Longitude: { type: Number, default: null },
    Phone: { type: String, trim: true, default: "" },
    PlannedArrivalTime: { type: String, default: "" },
    PlannedDepartureTime: { type: String, default: "" },
    PlannedServiceTime: { type: Number, default: 0, min: 0 },
    OrderIDs: [{ type: mongoose.Schema.Types.ObjectId, ref: "SalesOrder" }],
    OrderCodes: [{ type: String, trim: true, uppercase: true }],
    CODAmount: { type: Number, default: 0, min: 0 },
    Status: { type: String, enum: Object.values(TripTaskStatus), default: TripTaskStatus.PENDING, index: true },
    ArrivedAt: { type: Date, default: null },
    CompletedAt: { type: Date, default: null },
    FailedAt: { type: Date, default: null },
    FailureReason: { type: String, trim: true, default: "" },
    DriverNote: { type: String, trim: true, default: "" },
    PodImages: [{ type: String }],
    SignatureImage: { type: String, default: "" },
    CashCollected: { type: Number, default: 0, min: 0 }
  },
  { _id: false }
);

const tripSchema = new mongoose.Schema(
  {
    TripCode: { type: String, required: true, trim: true, uppercase: true, unique: true },
    OrganizationID: { type: mongoose.Schema.Types.ObjectId, ref: "Organization", required: true, index: true },
    RoutePlanID: { type: mongoose.Schema.Types.ObjectId, ref: "RoutePlan", required: true, index: true },
    DeliveryRouteID: { type: mongoose.Schema.Types.ObjectId, ref: "DeliveryRoute", required: true, unique: true, index: true },
    VehicleID: { type: mongoose.Schema.Types.ObjectId, ref: "Vehicle", default: null },
    VehicleCode: { type: String, trim: true, uppercase: true, default: "" },
    DepotCode: { type: String, trim: true, uppercase: true, default: "" },
    DepotName: { type: String, trim: true, default: "" },
    DepotAddress: { type: String, trim: true, default: "" },
    DepotLatitude: { type: Number, default: null },
    DepotLongitude: { type: Number, default: null },
    DriverID: { type: mongoose.Schema.Types.ObjectId, ref: "Driver", default: null, index: true },
    DriverUserID: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null, index: true },
    DriverCode: { type: String, trim: true, default: "" },
    DriverName: { type: String, trim: true, default: "" },
    DriverPhone: { type: String, trim: true, default: "" },
    IsOutsourced: { type: Boolean, default: false },
    ServiceID: { type: mongoose.Schema.Types.ObjectId, ref: "Service", default: null },
    ServiceCode: { type: String, trim: true, default: "" },
    ServiceName: { type: String, trim: true, default: "" },
    PlanDate: { type: Date, required: true, index: true },
    PlannedStartTime: { type: String, default: "" },
    PlannedReturnTime: { type: String, default: "" },
    Status: { type: String, enum: Object.values(TripStatus), default: TripStatus.ASSIGNED, index: true },
    /* Mốc thời gian + ảnh xác minh cho từng giai đoạn vận hành.
       Tài xế bắt buộc chụp ảnh khi: nhận chuyến, soạn hàng, xuất kho, về kho.
       Photos[] = base64/URL; *At = Date set khi gọi endpoint tương ứng. */
    ConfirmedAt:        { type: Date, default: null },
    ConfirmPhotos:      [{ type: String }],

    LoadingStartedAt:   { type: Date, default: null },
    LoadingPhotos:      [{ type: String }],
    LoadingNote:        { type: String, trim: true, default: "" },

    StartedAt:          { type: Date, default: null },
    StartPhotos:        [{ type: String }],
    StartOdometer:      { type: Number, default: null },

    ReturnedAt:         { type: Date, default: null },
    ReturnPhotos:       [{ type: String }],
    ReturnOdometer:     { type: Number, default: null },

    CompletedAt:        { type: Date, default: null },
    FinishPhotos:       [{ type: String }],
    FinishNote:         { type: String, trim: true, default: "" },

    CancelledAt:        { type: Date, default: null },
    CurrentTaskIndex: { type: Number, default: 1, min: 1 },
    LastLatitude: { type: Number, default: null },
    LastLongitude: { type: Number, default: null },
    LastSpeed: { type: Number, default: 0 },
    LastGpsAt: { type: Date, default: null },
    TotalDistance: { type: Number, default: 0, min: 0 },
    TotalWeight: { type: Number, default: 0, min: 0 },
    TotalCODCollected: { type: Number, default: 0, min: 0 },
    EstimatedCost: { type: Number, default: 0, min: 0 },
    Tasks: { type: [tripTaskSchema], default: [] },
    Notes: { type: String, trim: true, default: "" }
  },
  { timestamps: true }
);

tripSchema.index({ OrganizationID: 1, PlanDate: 1, Status: 1 });
tripSchema.index({ DriverID: 1, PlanDate: 1 });

export const Trip = mongoose.model("Trip", tripSchema);
