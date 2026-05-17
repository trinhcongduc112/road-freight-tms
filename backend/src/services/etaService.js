/**
 * etaService — quản lý ETA động cho chuyến vận tải.
 *
 * Bài toán: kế hoạch (`PlannedArrivalTime`) là dự kiến. Khi xe chạy thực tế,
 * mỗi điểm có thể đến sớm/trễ so với plan. Service này:
 *
 *   1. Tính độ lệch giờ tại điểm vừa hoàn thành.
 *   2. Quyết định cascade tự động hay yêu cầu tài xế giải trình:
 *        |lệch| ≤ DEVIATION_THRESHOLD_MIN  → cascade luôn, lý do "AUTO_SMALL".
 *        |lệch| >  DEVIATION_THRESHOLD_MIN → KHÔNG cascade ngay; frontend
 *           phải gọi `explainDeviation` (tạo TripIncident TIME_DEVIATION + cascade
 *           với lý do tài xế chọn).
 *   3. Cascade = dịch `PlannedArrivalTime` + `PlannedDepartureTime` của các điểm
 *      `StopIndex > fromStopIndex` đi `shiftMinutes` phút (âm = sớm, dương = trễ).
 *
 * Lý do tách 2 ngưỡng: tránh spam giải trình khi lệch nhỏ (giao thông tự nhiên);
 * lệch lớn phải có lý do để feed back vào traffic model + tính KPI tài xế.
 */
import { Trip, TripTaskStatus } from "../models/Trip.js";
import { getIO } from "../socket.js";

export const DEVIATION_THRESHOLD_MIN = 20;

const HHMM_RE = /^(\d{1,2}):(\d{2})$/;

/** "HH:mm" → số phút từ 00:00. Trả null nếu không parse được. */
export function hhmmToMinutes(value) {
  if (typeof value !== "string") return null;
  const m = HHMM_RE.exec(value.trim());
  if (!m) return null;
  const h = Number(m[1]);
  const mm = Number(m[2]);
  if (!Number.isFinite(h) || !Number.isFinite(mm) || h > 23 || mm > 59) return null;
  return h * 60 + mm;
}

/** Số phút (có thể âm) → "HH:mm". Wrap quanh 24h để tránh giờ âm/quá 23:59. */
export function minutesToHhmm(minutes) {
  if (!Number.isFinite(minutes)) return "";
  let total = Math.round(minutes);
  total = ((total % 1440) + 1440) % 1440;
  const h = Math.floor(total / 60);
  const m = total % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

/** Lấy "HH:mm" giờ địa phương (VN, UTC+7) cho 1 Date. */
export function dateToLocalHhmm(date = new Date(), tzOffsetMin = 7 * 60) {
  const ts = date.getTime() + tzOffsetMin * 60_000;
  const d = new Date(ts);
  return `${String(d.getUTCHours()).padStart(2, "0")}:${String(d.getUTCMinutes()).padStart(2, "0")}`;
}

/**
 * Cascade ETA: dịch PlannedArrivalTime/PlannedDepartureTime của các điểm
 * StopIndex > fromStopIndex (CHƯA COMPLETED/FAILED) đi `shiftMinutes` phút.
 *
 * - Không sửa OriginalPlannedArrivalTime (snapshot kế hoạch ban đầu cho báo cáo).
 * - Append 1 entry vào trip.EtaHistory.
 * - Emit Socket.IO event `trip:eta-updated` để web dispatcher refresh.
 *
 * @param {import('mongoose').Document} trip  - document Trip (mutable, chưa save)
 * @param {object} params
 * @param {number} params.fromStopIndex
 * @param {number} params.shiftMinutes        - âm = sớm hơn, dương = trễ hơn
 * @param {string} [params.reason="AUTO_SMALL"]
 * @param {import('mongoose').Types.ObjectId|null} [params.incidentId=null]
 * @returns {{ shifted: number, history: object }}
 */
export function cascadeEta(trip, { fromStopIndex, shiftMinutes, reason = "AUTO_SMALL", incidentId = null }) {
  const shift = Math.round(Number(shiftMinutes) || 0);
  if (shift === 0) return { shifted: 0, history: null };

  let shifted = 0;
  for (const task of trip.Tasks) {
    if (task.StopIndex <= fromStopIndex) continue;
    if ([TripTaskStatus.COMPLETED, TripTaskStatus.FAILED].includes(task.Status)) continue;

    const arr = hhmmToMinutes(task.PlannedArrivalTime);
    if (arr != null) task.PlannedArrivalTime = minutesToHhmm(arr + shift);
    const dep = hhmmToMinutes(task.PlannedDepartureTime);
    if (dep != null) task.PlannedDepartureTime = minutesToHhmm(dep + shift);
    shifted++;
  }

  const entry = {
    At: new Date(),
    FromStopIndex: fromStopIndex,
    ShiftMinutes: shift,
    Reason: reason,
    IncidentID: incidentId
  };
  trip.EtaHistory.push(entry);

  try {
    getIO()?.to(`org_${trip.OrganizationID.toString()}`).emit("trip:eta-updated", {
      tripId: String(trip._id),
      tripCode: trip.TripCode,
      vehicleCode: trip.VehicleCode,
      fromStopIndex,
      shiftMinutes: shift,
      reason,
      shiftedStops: shifted,
      at: entry.At
    });
  } catch { /* socket chưa init (tests) */ }

  return { shifted, history: entry };
}

/**
 * Sau khi task được mark COMPLETED, tính độ lệch giờ:
 *   - Ghi ActualArrivalTime, DeviationMinutes vào task.
 *   - Nếu |dev| ≤ ngưỡng → cascade luôn, gắn flag autoCascaded=true.
 *   - Nếu |dev| > ngưỡng → KHÔNG cascade (chờ giải trình), gắn requiresExplanation=true.
 *   - Nếu task không có PlannedArrivalTime hợp lệ (chuyến cũ) → bỏ qua, no-op.
 *
 * Caller (tripController.updateTask) gọi sau khi đã set task.Status = COMPLETED
 * và task.CompletedAt = Date. Lưu trip sau khi gọi xong.
 *
 * @returns {{ autoCascaded: boolean, requiresExplanation: boolean, deviationMin: number, shifted: number }}
 */
export function handleStopCompletion(trip, stopIndex) {
  const task = trip.Tasks.find((t) => t.StopIndex === stopIndex);
  if (!task) return { autoCascaded: false, requiresExplanation: false, deviationMin: 0, shifted: 0 };

  const plannedMin = hhmmToMinutes(task.PlannedArrivalTime);
  if (plannedMin == null) {
    /* Chuyến chưa có ETA kế hoạch (legacy/manual) — không cascade, không yêu cầu giải trình */
    return { autoCascaded: false, requiresExplanation: false, deviationMin: 0, shifted: 0 };
  }

  const actualDate = task.CompletedAt instanceof Date ? task.CompletedAt : new Date();
  const actualHhmm = dateToLocalHhmm(actualDate);
  const actualMin = hhmmToMinutes(actualHhmm);
  if (!task.OriginalPlannedArrivalTime) task.OriginalPlannedArrivalTime = task.PlannedArrivalTime;
  task.ActualArrivalTime = actualHhmm;

  /* Wrap-around: nếu lệch quá lớn (e.g. plan 23:50, actual 00:10) thì chuẩn về khoảng [-720, +720] */
  let dev = actualMin - plannedMin;
  if (dev >  720) dev -= 1440;
  if (dev < -720) dev += 1440;
  task.DeviationMinutes = dev;

  if (Math.abs(dev) <= DEVIATION_THRESHOLD_MIN) {
    const { shifted } = cascadeEta(trip, {
      fromStopIndex: stopIndex,
      shiftMinutes: dev,
      reason: "AUTO_SMALL"
    });
    return { autoCascaded: true, requiresExplanation: false, deviationMin: dev, shifted };
  }

  return { autoCascaded: false, requiresExplanation: true, deviationMin: dev, shifted: 0 };
}

/**
 * Tài xế giải trình lệch giờ > ngưỡng. Tạo TripIncident TIME_DEVIATION + cascade ETA.
 * Caller (controller) đã verify trip + task tồn tại.
 *
 * @param {object} params
 * @param {import('mongoose').Document} params.trip
 * @param {number} params.stopIndex
 * @param {number} params.expectedDelayMinutes   - lệch thực tế (âm/dương), tài xế xác nhận
 * @param {string} params.reason                 - DeviationReason enum
 * @param {string} [params.note]
 * @returns {Promise<{ incident, shifted: number }>}
 */
export async function explainDeviation({ TripIncident, IncidentType }, { trip, stopIndex, expectedDelayMinutes, reason, note = "", driverUserId, driverName, faultParty = "" }) {
  const task = trip.Tasks.find((t) => t.StopIndex === stopIndex);
  const lat = task?.Latitude ?? trip.LastLatitude ?? null;
  const lng = task?.Longitude ?? trip.LastLongitude ?? null;

  const incident = await TripIncident.create({
    OrganizationID: trip.OrganizationID,
    TripID:         trip._id,
    TripCode:       trip.TripCode,
    DriverUserID:   driverUserId ?? null,
    DriverName:     driverName ?? trip.DriverName ?? "",
    VehicleCode:    trip.VehicleCode,
    Type:           IncidentType.TIME_DEVIATION,
    Severity:       Math.abs(expectedDelayMinutes) >= 60 ? "HIGH" : "MEDIUM",
    Description:    String(note).slice(0, 1000),
    Latitude:       lat,
    Longitude:      lng,
    StopIndex:      stopIndex,
    ExpectedDelayMinutes: expectedDelayMinutes,
    DeviationReason:      reason,
    FaultParty:           faultParty
  });

  const { shifted } = cascadeEta(trip, {
    fromStopIndex: stopIndex,
    shiftMinutes:  expectedDelayMinutes,
    reason,
    incidentId:    incident._id
  });

  return { incident, shifted };
}
