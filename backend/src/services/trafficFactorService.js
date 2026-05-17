/**
 * trafficFactorService — đọc/ghi/seed/recompute traffic factor.
 *
 * 4 lớp logic (tất cả miễn phí, không phụ thuộc API ngoài):
 *   Lớp 1: Hệ số mặc định hard-code (initial seed nếu DB rỗng).
 *   Lớp 2: Hệ số do admin chỉnh tay (UI cấu hình).
 *   Lớp 3: Hệ số tự cập nhật từ Trip.Tasks.DeviationMinutes (cron job hằng tuần).
 *   Lớp 4: Hệ số tạm crowdsource từ incident TRAFFIC (sống 2 giờ).
 *
 * Service này expose:
 *   - seedDefaults(orgId): tạo bộ mặc định nếu chưa có cho org.
 *   - buildFactorTable(orgId, depot?): trả về object phẳng cho optimizer.
 *   - addCrowdsourceTraffic({orgId, zoneType, factor, ttlMinutes}): tài xế báo tắc.
 *   - recomputeFromHistory(orgId, sinceDate): job hằng tuần tự học.
 */
import { TrafficFactor, FactorScope, ZoneType } from "../models/TrafficFactor.js";
import { Trip, TripStatus } from "../models/Trip.js";
import { hhmmToMinutes } from "./etaService.js";

/* Lớp 1: hằng số mặc định. Số liệu tham khảo từ pattern giao thông VN. */
const DEFAULT_HOUR_BUCKETS = [
  { start: 0,  end: 6,  factor: 0.85, note: "Đêm/sáng sớm — đường thoáng" },
  { start: 6,  end: 7,  factor: 1.15, note: "Bắt đầu rush sáng" },
  { start: 7,  end: 9,  factor: 1.60, note: "Rush giờ đi làm" },
  { start: 9,  end: 11, factor: 1.10, note: "Sau rush sáng" },
  { start: 11, end: 13, factor: 1.20, note: "Giờ trưa" },
  { start: 13, end: 17, factor: 1.10, note: "Đầu giờ chiều" },
  { start: 17, end: 20, factor: 1.70, note: "Rush giờ tan tầm" },
  { start: 20, end: 22, factor: 1.15, note: "Tối — vẫn đông" },
  { start: 22, end: 24, factor: 0.95, note: "Đêm" }
];

const DEFAULT_DOW = [
  { dow: 0, factor: 0.85, note: "Chủ nhật — đường thoáng" },
  { dow: 1, factor: 1.10, note: "Thứ 2 — đông đầu tuần" },
  { dow: 2, factor: 1.05 },
  { dow: 3, factor: 1.05 },
  { dow: 4, factor: 1.05 },
  { dow: 5, factor: 1.15, note: "Thứ 6 — đông cuối tuần" },
  { dow: 6, factor: 0.95, note: "Thứ 7" }
];

const DEFAULT_ZONES = [
  { zone: ZoneType.URBAN,    from: 0,  to: 8,    factor: 1.40, note: "Nội đô — đông, đèn đỏ nhiều" },
  { zone: ZoneType.SUBURBAN, from: 8,  to: 25,   factor: 1.10, note: "Ngoại thành" },
  { zone: ZoneType.HIGHWAY,  from: 25, to: 9999, factor: 0.90, note: "Cao tốc / quốc lộ" }
];

export async function seedDefaults(orgId) {
  const existing = await TrafficFactor.countDocuments({ OrganizationID: orgId });
  if (existing > 0) return { created: 0, skipped: true };

  const docs = [
    ...DEFAULT_HOUR_BUCKETS.map((b) => ({
      OrganizationID: orgId, Scope: FactorScope.HOUR,
      HourStart: b.start, HourEnd: b.end,
      Factor: b.factor, Note: b.note ?? ""
    })),
    ...DEFAULT_DOW.map((d) => ({
      OrganizationID: orgId, Scope: FactorScope.DOW,
      DayOfWeek: d.dow,
      Factor: d.factor, Note: d.note ?? ""
    })),
    ...DEFAULT_ZONES.map((z) => ({
      OrganizationID: orgId, Scope: FactorScope.ZONE,
      ZoneType: z.zone, ZoneRadiusKmFrom: z.from, ZoneRadiusKmTo: z.to,
      Factor: z.factor, Note: z.note ?? ""
    }))
  ];
  await TrafficFactor.insertMany(docs);
  return { created: docs.length, skipped: false };
}

/**
 * Xoá các record tạm đã hết hạn (gọi mỗi khi load table).
 * Rẻ — chỉ delete theo index ExpiresAt.
 */
async function purgeExpired() {
  await TrafficFactor.deleteMany({ IsTemporary: true, ExpiresAt: { $lt: new Date() } });
}

/**
 * Build object phẳng để gửi sang Python optimizer.
 * Optimizer (Python) sẽ áp dụng theo:
 *   factor(hour, dow, distFromDepotKm) = hourFactor × dowFactor × zoneFactor
 *
 * @param {ObjectId|null} orgId
 * @returns {Promise<{ hourBuckets: Array, dow: Object, zones: Array }>}
 */
export async function buildFactorTable(orgId) {
  await purgeExpired();

  const all = await TrafficFactor.find({
    $or: [{ OrganizationID: orgId }, { OrganizationID: null }]
  }).lean();

  /* Override: nếu org có record cùng scope thì lấy record của org, bỏ system default. */
  const orgScoped = all.filter((f) => String(f.OrganizationID) === String(orgId));
  const useOrgOnly = orgScoped.length > 0;
  const records = useOrgOnly ? orgScoped : all;

  const hourBuckets = records
    .filter((r) => r.Scope === FactorScope.HOUR && Number.isFinite(r.HourStart) && Number.isFinite(r.HourEnd))
    .map((r) => ({
      start: r.HourStart, end: r.HourEnd,
      factor: r.Factor, isTemporary: r.IsTemporary
    }))
    .sort((a, b) => a.start - b.start);

  const dow = {};
  for (const r of records) {
    if (r.Scope === FactorScope.DOW && Number.isFinite(r.DayOfWeek)) {
      dow[r.DayOfWeek] = r.Factor;
    }
  }

  const zones = records
    .filter((r) => r.Scope === FactorScope.ZONE && r.ZoneType)
    .map((r) => ({
      type: r.ZoneType,
      fromKm: r.ZoneRadiusKmFrom ?? 0,
      toKm:   r.ZoneRadiusKmTo ?? 9999,
      factor: r.Factor,
      isTemporary: r.IsTemporary
    }))
    .sort((a, b) => a.fromKm - b.fromKm);

  return { hourBuckets, dow, zones };
}

/**
 * Lớp 4: tài xế báo tắc đường → tạo record tạm tăng hệ số vùng trong N phút.
 * Mặc định 120 phút (2 giờ).
 *
 * @param {object} params
 * @param {ObjectId} params.orgId
 * @param {"urban"|"suburban"|"highway"} params.zoneType
 * @param {number}   [params.factor=1.5]      - hệ số nhân thêm cho vùng đó
 * @param {number}   [params.ttlMinutes=120]
 */
export async function addCrowdsourceTraffic({ orgId, zoneType, factor = 1.5, ttlMinutes = 120 }) {
  if (!Object.values(ZoneType).includes(zoneType)) return null;
  const expiresAt = new Date(Date.now() + ttlMinutes * 60_000);

  /* Nếu đã có record tạm cùng vùng còn hiệu lực, refresh (lấy max factor + đẩy expiry) */
  const existing = await TrafficFactor.findOne({
    OrganizationID: orgId, Scope: FactorScope.ZONE, ZoneType: zoneType, IsTemporary: true,
    ExpiresAt: { $gt: new Date() }
  });
  if (existing) {
    existing.Factor = Math.max(existing.Factor, factor);
    existing.ExpiresAt = expiresAt;
    return existing.save();
  }
  return TrafficFactor.create({
    OrganizationID: orgId, Scope: FactorScope.ZONE, ZoneType: zoneType,
    Factor: factor, IsTemporary: true, ExpiresAt: expiresAt,
    Note: "Crowdsource: tài xế báo tắc"
  });
}

/**
 * Lớp 3: hằng tuần tự cập nhật factor từ dữ liệu Trip thực tế.
 *
 * Cách tính: với mỗi task đã COMPLETED có DeviationMinutes (trễ/sớm),
 * suy ra ratio = (planned_travel + dev) / planned_travel.
 * Group theo khung giờ. Cập nhật factor cũ bằng EMA (exponential moving avg)
 * với alpha=0.3 để vừa học vừa không quá nhạy với 1 vài outlier.
 *
 * @param {ObjectId|null} orgId
 * @param {Date} [sinceDate=30 days ago]
 * @returns {Promise<{ updated: number, sampleSize: number }>}
 */
export async function recomputeFromHistory(orgId, sinceDate = null) {
  const since = sinceDate ?? new Date(Date.now() - 30 * 24 * 60 * 60_000);
  const filter = { Status: TripStatus.COMPLETED, PlanDate: { $gte: since } };
  if (orgId) filter.OrganizationID = orgId;

  const trips = await Trip.find(filter, { Tasks: 1, OrganizationID: 1, PlanDate: 1 }).lean();

  /* Bucket index = hour của PlannedArrivalTime */
  const byHour = new Map(); // hour → [ratio,...]
  for (const trip of trips) {
    for (const task of (trip.Tasks ?? [])) {
      if (typeof task.DeviationMinutes !== "number") continue;
      const plannedMin = hhmmToMinutes(task.OriginalPlannedArrivalTime || task.PlannedArrivalTime);
      if (plannedMin == null) continue;
      const hour = Math.floor(plannedMin / 60);
      /* travel time chuẩn ~30 phút giữa các điểm. Ratio = 1 + dev/baseline */
      const baseline = 30;
      const ratio = Math.max(0.5, Math.min(3.0, 1 + task.DeviationMinutes / baseline));
      if (!byHour.has(hour)) byHour.set(hour, []);
      byHour.get(hour).push(ratio);
    }
  }

  let updated = 0;
  const alpha = 0.3;
  let totalSamples = 0;

  for (const [hour, ratios] of byHour.entries()) {
    if (ratios.length < 3) continue; // cần tối thiểu 3 sample để cập nhật
    ratios.sort((a, b) => a - b);
    const p75 = ratios[Math.floor(ratios.length * 0.75)];

    const buckets = await TrafficFactor.find({
      OrganizationID: orgId, Scope: FactorScope.HOUR,
      HourStart: { $lte: hour }, HourEnd: { $gt: hour }, IsTemporary: false
    });
    for (const b of buckets) {
      const newFactor = b.Factor * (1 - alpha) + p75 * alpha;
      b.Factor = Math.max(0.5, Math.min(3.0, Number(newFactor.toFixed(3))));
      b.SampleSize = (b.SampleSize ?? 0) + ratios.length;
      b.LastUpdatedAt = new Date();
      await b.save();
      updated++;
      totalSamples += ratios.length;
    }
  }

  return { updated, sampleSize: totalSamples };
}
