import mongoose from "mongoose";

/**
 * In-app notification gửi tới 1 User cụ thể.
 *
 * Dùng cho:
 *   - Gán chuyến mới (DRIVER_TRIP_ASSIGNED)
 *   - Gán bảo dưỡng xe (DRIVER_MAINTENANCE_ASSIGNED)
 *   - Cập nhật trạng thái (TRIP_STATUS_CHANGED)
 *   - Bất kỳ thông báo realtime nào khác trong app
 *
 * Khi tạo entry mới → emit qua Socket.IO `room user_<userId>` event "notification:new"
 * → frontend mobile / web nhận realtime + cập nhật badge count.
 */
export const NotificationType = Object.freeze({
  TRIP_ASSIGNED: "TRIP_ASSIGNED",
  MAINTENANCE_ASSIGNED: "MAINTENANCE_ASSIGNED",
  TRIP_STATUS_CHANGED: "TRIP_STATUS_CHANGED",
  GENERAL: "GENERAL"
});

const notificationSchema = new mongoose.Schema(
  {
    UserID: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true
    },
    OrganizationID: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Organization",
      default: null,
      index: true
    },
    Type: {
      type: String,
      enum: Object.values(NotificationType),
      default: NotificationType.GENERAL,
      index: true
    },
    Title: { type: String, trim: true, required: true },
    Body: { type: String, trim: true, default: "" },
    Link: { type: String, trim: true, default: "" }, // deep-link mở screen tương ứng
    Metadata: { type: mongoose.Schema.Types.Mixed, default: null },
    IsRead: { type: Boolean, default: false, index: true },
    ReadAt: { type: Date, default: null }
  },
  { timestamps: { createdAt: "CreatedAt", updatedAt: false } }
);

notificationSchema.index({ UserID: 1, CreatedAt: -1 });
notificationSchema.index({ UserID: 1, IsRead: 1 });

export const Notification = mongoose.model("Notification", notificationSchema);
