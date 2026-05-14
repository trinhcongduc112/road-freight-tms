import mongoose from "mongoose";

export const IncidentType = Object.freeze({
  BREAKDOWN:   "BREAKDOWN",     // Hỏng xe
  ACCIDENT:    "ACCIDENT",      // Tai nạn
  TRAFFIC:     "TRAFFIC",       // Kẹt đường / tắc
  FUEL:        "FUEL",          // Hết / cần nạp nhiên liệu
  CARGO_ISSUE: "CARGO_ISSUE",   // Hàng hóa hỏng / mất
  WEATHER:     "WEATHER",       // Thời tiết xấu
  CUSTOMER:    "CUSTOMER",      // Khách hàng từ chối / không có mặt
  DEVIATION:   "DEVIATION",     // Hệ thống tự phát hiện đi sai lộ trình
  OTHER:       "OTHER"
});

export const IncidentSeverity = Object.freeze({
  LOW:    "LOW",
  MEDIUM: "MEDIUM",
  HIGH:   "HIGH",
  CRITICAL: "CRITICAL"
});

export const IncidentStatus = Object.freeze({
  OPEN:         "OPEN",
  ACKNOWLEDGED: "ACKNOWLEDGED",
  RESOLVED:     "RESOLVED",
  DISMISSED:    "DISMISSED"
});

const tripIncidentSchema = new mongoose.Schema(
  {
    OrganizationID: { type: mongoose.Schema.Types.ObjectId, ref: "Organization", required: true, index: true },
    TripID:         { type: mongoose.Schema.Types.ObjectId, ref: "Trip", required: true, index: true },
    TripCode:       { type: String, trim: true, uppercase: true, default: "" },
    DriverUserID:   { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null, index: true },
    DriverName:     { type: String, trim: true, default: "" },
    VehicleCode:    { type: String, trim: true, uppercase: true, default: "" },

    Type:     { type: String, enum: Object.values(IncidentType),     default: IncidentType.OTHER, index: true },
    Severity: { type: String, enum: Object.values(IncidentSeverity), default: IncidentSeverity.MEDIUM },
    Status:   { type: String, enum: Object.values(IncidentStatus),   default: IncidentStatus.OPEN, index: true },

    Description: { type: String, trim: true, default: "" },
    Latitude:    { type: Number, default: null },
    Longitude:   { type: Number, default: null },
    Photos:      [{ type: String }],

    /* For DEVIATION incidents auto-emitted by the server */
    DeviationDistance: { type: Number, default: 0 },  // meters off planned path
    DeviationCount:    { type: Number, default: 0 },  // consecutive GPS pings off-path

    ReportedAt:      { type: Date, default: Date.now },
    AcknowledgedAt:  { type: Date, default: null },
    AcknowledgedBy:  { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    ResolvedAt:      { type: Date, default: null },
    ResolvedBy:      { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    DispatcherNote:  { type: String, trim: true, default: "" }
  },
  { timestamps: true }
);

tripIncidentSchema.index({ OrganizationID: 1, Status: 1, ReportedAt: -1 });

export const TripIncident = mongoose.model("TripIncident", tripIncidentSchema);
