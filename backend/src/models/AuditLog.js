import mongoose from "mongoose";

/**
 * AuditLog — ghi lại mọi thao tác CRUD nhạy cảm trên hệ thống.
 * Phục vụ: tuân thủ ISO 27001 / ISO 25010 (Reliability), forensic, compliance reporting.
 *
 * Mỗi entry là 1 hành động không thể chỉnh sửa (append-only).
 */
const auditLogSchema = new mongoose.Schema(
  {
    OrganizationID: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Organization",
      default: null,
      index: true
    },
    UserID: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null, index: true },
    UserEmail: { type: String, trim: true, default: "" },
    UserName: { type: String, trim: true, default: "" },
    Action: {
      type: String,
      required: true,
      uppercase: true,
      enum: ["CREATE", "UPDATE", "DELETE", "LOGIN", "LOGOUT", "EXPORT", "IMPORT", "OTHER"],
      index: true
    },
    Resource: { type: String, trim: true, required: true, index: true }, // "Order", "Trip", "User"...
    ResourceID: { type: String, trim: true, default: "" }, // mongo _id hoặc code
    Method: { type: String, trim: true, default: "" }, // HTTP method
    Path: { type: String, trim: true, default: "" }, // request path
    StatusCode: { type: Number, default: null },
    Changes: { type: mongoose.Schema.Types.Mixed, default: null }, // diff hoặc payload tóm tắt
    IP: { type: String, trim: true, default: "" },
    UserAgent: { type: String, trim: true, default: "" },
    DurationMs: { type: Number, default: 0 }
  },
  { timestamps: { createdAt: "CreatedAt", updatedAt: false } }
);

auditLogSchema.index({ OrganizationID: 1, CreatedAt: -1 });
auditLogSchema.index({ Resource: 1, CreatedAt: -1 });

export const AuditLog = mongoose.model("AuditLog", auditLogSchema);
