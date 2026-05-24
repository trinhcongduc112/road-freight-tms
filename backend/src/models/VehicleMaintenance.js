import mongoose from "mongoose";

/**
 * VehicleMaintenance — theo dõi bảo dưỡng xe.
 *
 * Mỗi xe có nhiều bản ghi maintenance (history), và 1 plan kế tiếp.
 * Hệ thống cảnh báo khi:
 *   - Sắp đến hạn bảo dưỡng (km hiện tại > km plan - 500)
 *   - Bảo hiểm sắp hết hạn (InsuranceExpireAt - hôm nay < 30 ngày)
 *   - Đăng kiểm sắp hết hạn (RegistrationExpireAt - hôm nay < 30 ngày)
 */
export const MaintenanceType = Object.freeze({
  OIL_CHANGE: "OIL_CHANGE",             // Thay dầu nhớt — định kỳ 5000km
  TIRE_ROTATION: "TIRE_ROTATION",       // Đảo lốp — định kỳ 10000km
  BRAKE_CHECK: "BRAKE_CHECK",           // Kiểm tra phanh
  GENERAL: "GENERAL",                   // Bảo dưỡng tổng quát
  INSURANCE: "INSURANCE",               // Gia hạn bảo hiểm
  REGISTRATION: "REGISTRATION",         // Gia hạn đăng kiểm
  REPAIR: "REPAIR",                     // Sửa chữa đột xuất
  OTHER: "OTHER"
});

/**
 * Workflow trạng thái:
 *   SCHEDULED        → vừa tạo, chưa giao hoặc TX chưa nhận
 *   ACKNOWLEDGED     → tài xế đã ấn "Nhận việc"
 *   AWAITING_REVIEW  → tài xế đã hoàn thành + upload ảnh, chờ dispatcher duyệt
 *   COMPLETED        → dispatcher đã duyệt → kết thúc
 *   CANCELLED        → bị huỷ
 *
 * IN_PROGRESS giữ lại cho backward compat (manual update của admin).
 */
export const MaintenanceStatus = Object.freeze({
  SCHEDULED: "SCHEDULED",
  ACKNOWLEDGED: "ACKNOWLEDGED",
  IN_PROGRESS: "IN_PROGRESS",
  AWAITING_REVIEW: "AWAITING_REVIEW",
  COMPLETED: "COMPLETED",
  CANCELLED: "CANCELLED"
});

const maintenanceSchema = new mongoose.Schema(
  {
    OrganizationID: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Organization",
      required: true,
      index: true
    },
    VehicleID: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Vehicle",
      required: true,
      index: true
    },
    VehicleCode: { type: String, trim: true, uppercase: true, default: "" },
    // Tài xế được phân công đưa xe đi bảo dưỡng (optional — admin có thể tự đưa)
    DriverID: { type: mongoose.Schema.Types.ObjectId, ref: "Driver", default: null, index: true },
    DriverCode: { type: String, trim: true, default: "" },
    DriverName: { type: String, trim: true, default: "" },
    Type: {
      type: String,
      enum: Object.values(MaintenanceType),
      required: true,
      index: true
    },
    Title: { type: String, trim: true, required: true },
    Description: { type: String, trim: true, default: "" },
    ScheduledDate: { type: Date, required: true, index: true },
    CompletedDate: { type: Date, default: null },
    OdometerAtService: { type: Number, default: 0, min: 0 },
    NextServiceOdometer: { type: Number, default: 0, min: 0 },
    NextServiceDate: { type: Date, default: null },
    Cost: { type: Number, default: 0, min: 0 },
    Vendor: { type: String, trim: true, default: "" },
    Status: {
      type: String,
      enum: Object.values(MaintenanceStatus),
      default: MaintenanceStatus.SCHEDULED,
      index: true
    },
    Notes: { type: String, trim: true, default: "" },
    CreatedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },

    // Workflow tài xế thực hiện
    DriverAcknowledgedAt: { type: Date, default: null },   // TX bấm "Nhận việc"
    DriverCompletedAt: { type: Date, default: null },      // TX bấm "Hoàn thành" + upload ảnh
    CompletionPhotos: [{ type: String }],                  // Ảnh hoá đơn / xe sau bảo dưỡng (base64 / URL)
    CompletionNote: { type: String, trim: true, default: "" },
    ApprovedAt: { type: Date, default: null },             // Dispatcher duyệt
    ApprovedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null }
  },
  { timestamps: true }
);

maintenanceSchema.index({ OrganizationID: 1, VehicleID: 1, ScheduledDate: -1 });
maintenanceSchema.index({ OrganizationID: 1, Status: 1, ScheduledDate: 1 });

export const VehicleMaintenance = mongoose.model("VehicleMaintenance", maintenanceSchema);
