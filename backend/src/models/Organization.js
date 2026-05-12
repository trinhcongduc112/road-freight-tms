import mongoose from "mongoose";

/**
 * BA 3.6.2 - Bảng 3.7. Đặc tả bảng Organization.
 * Multi-tenant root entity — supports tree (parent/child) for DAC scoping (BA 3.1.2).
 *
 * Mở rộng từ Abivin vRoute data model:
 *  - OrgType (= Abivin "Organization Category"): phân loại tổ chức trong cây.
 *  - Latitude/Longitude/OpenTime/CloseTime: bắt buộc khi OrgType ∈ {DEPOT, SUN, CROSSDOCK}
 *    để dùng cho Route Plan Optimization (Sprint 3+).
 *  - TimeZone/Country/Currency: chỉ có hiệu lực ở Manufacturer (top-level).
 */
export const OrgType = Object.freeze({
  MANUFACTURER: "MANUFACTURER",
  DISTRIBUTOR: "DISTRIBUTOR",
  BRANCH: "BRANCH",
  DEPOT: "DEPOT",
  SUN: "SUN",
  CROSSDOCK: "CROSSDOCK",
  SHIPPER: "SHIPPER"
});

const TIME_REGEX = /^([01]\d|2[0-3]):[0-5]\d$/;

const organizationSchema = new mongoose.Schema(
  {
    XCode: { type: String, required: true, unique: true, uppercase: true, trim: true },
    XName: { type: String, required: true, trim: true },
    Address: { type: String, trim: true, default: "" },
    Status: { type: String, enum: ["Active", "Inactive"], default: "Active", index: true },

    OrgType: {
      type: String,
      enum: Object.values(OrgType),
      default: null,
      index: true
    },

    Parent: { type: mongoose.Schema.Types.ObjectId, ref: "Organization", default: null, index: true },
    Path: { type: [mongoose.Schema.Types.ObjectId], default: [], index: true },

    Latitude: { type: Number, default: null, min: -90, max: 90 },
    Longitude: { type: Number, default: null, min: -180, max: 180 },

    OpenTime: { type: String, default: null, validate: (v) => v == null || TIME_REGEX.test(v) },
    CloseTime: { type: String, default: null, validate: (v) => v == null || TIME_REGEX.test(v) },

    Phone: { type: String, trim: true, default: "" },
    Country: { type: String, trim: true, default: "" },
    Currency: { type: String, trim: true, default: "" },
    TimeZone: { type: String, trim: true, default: "" },

    CreatedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", index: true }
  },
  { timestamps: true }
);

organizationSchema.index({ Parent: 1, XCode: 1 });
organizationSchema.index({ OrgType: 1, Status: 1 });

export const Organization = mongoose.model("Organization", organizationSchema);
