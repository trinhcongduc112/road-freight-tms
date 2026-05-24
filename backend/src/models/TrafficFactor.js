/**
 * TrafficFactor — mô hình tắc đường empirical, miễn phí, tự học.
 *
 * Mỗi record là 1 hệ số nhân vào thời gian di chuyển theo công thức:
 *
 *   adjusted_minutes = base_minutes × HourFactor × DowFactor × ZoneFactor
 *
 * Có 3 nhóm record được phân biệt qua field `Scope`:
 *
 *   - "HOUR": áp dụng theo khung giờ. HourStart/HourEnd ∈ [0,24).
 *   - "DOW":  áp dụng theo thứ trong tuần. DayOfWeek 0=CN ... 6=T7.
 *   - "ZONE": áp dụng theo loại vùng. ZoneType: "urban"|"suburban"|"highway".
 *
 * Field `IsTemporary` + `ExpiresAt`: cho crowdsource — khi tài xế báo TRAFFIC,
 * tạo record tạm cho khu vực đó hiệu lực 2 giờ. Job dọn dẹp xoá khi hết hạn.
 *
 * `SampleSize` + `LastUpdatedAt` cho cron job hằng tuần tự hiệu chỉnh factor
 * dựa trên dữ liệu thực (Trip.Tasks.DeviationMinutes).
 *
 * Scope theo OrganizationID để đa khách (multi-tenant). null = system default.
 */
import mongoose from "mongoose";

export const FactorScope = Object.freeze({
  HOUR: "HOUR",
  DOW:  "DOW",
  ZONE: "ZONE"
});

export const ZoneType = Object.freeze({
  URBAN:    "urban",
  SUBURBAN: "suburban",
  HIGHWAY:  "highway"
});

const trafficFactorSchema = new mongoose.Schema(
  {
    OrganizationID: { type: mongoose.Schema.Types.ObjectId, ref: "Organization", default: null, index: true },
    Scope:          { type: String, enum: Object.values(FactorScope), required: true, index: true },

    /* HOUR scope */
    HourStart: { type: Number, default: null, min: 0, max: 23 },
    HourEnd:   { type: Number, default: null, min: 0, max: 24 },

    /* DOW scope (0 = Sunday, 6 = Saturday) */
    DayOfWeek: { type: Number, default: null, min: 0, max: 6 },

    /* ZONE scope */
    ZoneType: { type: String, enum: [...Object.values(ZoneType), null], default: null },
    /* Bán kính (km) tính từ depot — dùng cho cron job phân loại tự động:
       0–8km = urban, 8–25km = suburban, >25km = highway. */
    ZoneRadiusKmFrom: { type: Number, default: null },
    ZoneRadiusKmTo:   { type: Number, default: null },

    Factor:        { type: Number, required: true, min: 0.1, max: 5.0 },
    SampleSize:    { type: Number, default: 0 },
    LastUpdatedAt: { type: Date,   default: Date.now },
    Note:          { type: String, trim: true, default: "" },

    /* Crowdsource (tài xế báo TRAFFIC) — record tạm */
    IsTemporary: { type: Boolean, default: false },
    ExpiresAt:   { type: Date, default: null, index: true }
  },
  { timestamps: true }
);

trafficFactorSchema.index({ OrganizationID: 1, Scope: 1, IsTemporary: 1 });

export const TrafficFactor = mongoose.model("TrafficFactor", trafficFactorSchema);
