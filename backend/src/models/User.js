import bcrypt from "bcryptjs";
import mongoose from "mongoose";

/**
 * BA 3.6.2 - Bảng 3.9. Đặc tả bảng User.
 * - 1 user có thể tham gia nhiều Organization (OrganizationIDs[]).
 * - RoleGroupID chỉ vào 1 RoleGroup ràng buộc với org.
 * - IsSuperAdmin = "Original User" trong BA 3.1.1 (Root Level / SuperAdmin).
 *
 * Mở rộng cho Sprint 0.5 — Auth hardening:
 *  - FullName, Phone: lấy từ Abivin user model.
 *  - EmailVerifiedAt: bắt buộc verify trước khi đăng nhập (trừ SuperAdmin & user được mời).
 *  - VerificationToken / ResetToken / InvitationToken: hash + TTL,
 *    xài one-time, store dạng hash để phòng leak DB.
 *  - Status: pending | active | locked.
 */
export const UserStatus = Object.freeze({
  PENDING_VERIFY: "PENDING_VERIFY",
  PENDING_INVITE: "PENDING_INVITE",
  ACTIVE: "ACTIVE",
  LOCKED: "LOCKED"
});

export const FunctionRole = Object.freeze({
  IT_ADMIN:           "IT_ADMIN",
  PLANNER:            "PLANNER",
  DISPATCHER:         "DISPATCHER",
  PLANNER_DISPATCHER: "PLANNER_DISPATCHER",
  ACCOUNTANT:         "ACCOUNTANT",
  DRIVER:             "DRIVER"
});

const VEHICLE_TYPES_USER = ["TRUCK", "SEMI_TRUCK", "TRAILER", "BIKE"];

const userSchema = new mongoose.Schema(
  {
    XCode: { type: String, trim: true },
    UserName: { type: String, required: true, unique: true, trim: true },
    FullName: { type: String, trim: true, default: "" },
    Email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    Phone: { type: String, trim: true, default: "" },

    PasswordHash: { type: String, default: null, select: false },

    OrganizationIDs: {
      type: [{ type: mongoose.Schema.Types.ObjectId, ref: "Organization" }],
      default: []
    },
    RoleGroupID: { type: mongoose.Schema.Types.ObjectId, ref: "RoleGroup", default: null },

    FunctionRoles: {
      type: [String],
      enum: Object.values(FunctionRole),
      default: []
    },
    AllowedVehicleTypes: {
      type: [String],
      enum: VEHICLE_TYPES_USER,
      default: []
    },

    IsSuperAdmin: { type: Boolean, default: false, index: true },
    IsActive: { type: Boolean, default: true },

    Status: {
      type: String,
      enum: Object.values(UserStatus),
      default: UserStatus.ACTIVE,
      index: true
    },

    EmailVerifiedAt: { type: Date, default: null },

    VerificationTokenHash: { type: String, default: null, select: false },
    VerificationTokenExpiresAt: { type: Date, default: null, select: false },

    ResetTokenHash: { type: String, default: null, select: false },
    ResetTokenExpiresAt: { type: Date, default: null, select: false },

    InvitationTokenHash: { type: String, default: null, select: false },
    InvitationTokenExpiresAt: { type: Date, default: null, select: false },
    InvitedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    InvitedAt: { type: Date, default: null },

    LastLoginAt: { type: Date, default: null }
  },
  { timestamps: true }
);

userSchema.methods.verifyPassword = function verifyPassword(password) {
  if (!this.PasswordHash) return Promise.resolve(false);
  return bcrypt.compare(password, this.PasswordHash);
};

userSchema.statics.hashPassword = function hashPassword(password) {
  return bcrypt.hash(password, 12);
};

export const User = mongoose.model("User", userSchema);
