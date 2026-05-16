import { VehicleMaintenance, MaintenanceStatus } from "../models/VehicleMaintenance.js";
import { Vehicle } from "../models/Vehicle.js";
import { Trip } from "../models/Trip.js";
import { Driver } from "../models/Driver.js";
import { ApiError } from "../utils/apiError.js";
import { scopeFilter } from "../middlewares/dac.js";
import { createInAppNotification } from "../services/notificationService.js";
import { NotificationType } from "../models/Notification.js";

const TYPE_LABEL = {
  OIL_CHANGE: "Thay dầu nhớt",
  TIRE_ROTATION: "Đảo lốp",
  BRAKE_CHECK: "Kiểm tra phanh",
  GENERAL: "Bảo dưỡng tổng quát",
  INSURANCE: "Gia hạn bảo hiểm",
  REGISTRATION: "Gia hạn đăng kiểm",
  REPAIR: "Sửa chữa đột xuất",
  OTHER: "Bảo dưỡng"
};

function formatDate(d) {
  if (!d) return "";
  const x = new Date(d);
  return `${String(x.getDate()).padStart(2, "0")}/${String(x.getMonth() + 1).padStart(2, "0")}/${x.getFullYear()}`;
}

async function notifyDriverMaintenance(maintenance, driver, action = "assigned") {
  if (!driver?.LinkedUserID) return; // Tài xế chưa link với user → bỏ qua
  const title = action === "assigned"
    ? "Bạn được phân công đưa xe đi bảo dưỡng"
    : "Lịch bảo dưỡng đã cập nhật";
  const deadline = maintenance.ScheduledDate;
  const isOverdue = deadline && new Date(deadline) < new Date();
  const deadlineLabel = isOverdue
    ? `⚠ Hạn: ${formatDate(deadline)} (đã quá hạn)`
    : `Hạn: ${formatDate(deadline)}`;
  const body = `${TYPE_LABEL[maintenance.Type] ?? maintenance.Type} — Xe ${maintenance.VehicleCode}\n${deadlineLabel}${maintenance.Vendor ? ` · Tại ${maintenance.Vendor}` : ""}\nMở để xác nhận nhận việc`;
  await createInAppNotification({
    userId: driver.LinkedUserID,
    orgId: maintenance.OrganizationID,
    type: NotificationType.MAINTENANCE_ASSIGNED,
    title,
    body,
    link: `maintenance:${maintenance._id}`,
    metadata: {
      maintenanceId: String(maintenance._id),
      vehicleCode: maintenance.VehicleCode,
      type: maintenance.Type,
      scheduledDate: maintenance.ScheduledDate
    }
  });
}

function getOrgScopeFilter(req) {
  return scopeFilter(req.orgScope, "OrganizationID");
}
function primaryOrgId(req) {
  // Khi tạo bản ghi mới, chọn org gốc của user (ko expand subtree)
  return req.role?.OrganizationID ?? req.user?.OrganizationIDs?.[0] ?? null;
}

/**
 * GET /api/maintenance
 * Query: vehicleId, status, type, from, to, page, limit
 */
export async function listMaintenance(req, res) {
  const filter = getOrgScopeFilter(req);
  if (req.query.vehicleId) filter.VehicleID = req.query.vehicleId;
  if (req.query.status) filter.Status = String(req.query.status).toUpperCase();
  if (req.query.type) filter.Type = String(req.query.type).toUpperCase();
  if (req.query.from || req.query.to) {
    filter.ScheduledDate = {};
    if (req.query.from) filter.ScheduledDate.$gte = new Date(req.query.from);
    if (req.query.to) filter.ScheduledDate.$lte = new Date(req.query.to);
  }

  const page = Math.max(1, Number(req.query.page) || 1);
  const limit = Math.min(200, Math.max(1, Number(req.query.limit) || 50));
  const skip = (page - 1) * limit;

  const [items, total] = await Promise.all([
    VehicleMaintenance.find(filter).sort({ ScheduledDate: -1 }).skip(skip).limit(limit).lean(),
    VehicleMaintenance.countDocuments(filter)
  ]);

  res.json({ success: true, data: { items, total, page, limit } });
}

export async function createMaintenance(req, res) {
  const body = req.body ?? {};
  if (!body.VehicleID) throw new ApiError(400, "VehicleID is required");
  if (!body.Type) throw new ApiError(400, "Type is required");
  if (!body.Title) throw new ApiError(400, "Title is required");
  if (!body.ScheduledDate) throw new ApiError(400, "ScheduledDate is required");

  // Vehicle phải nằm trong scope (org của user hoặc sub-org)
  const vehicle = await Vehicle.findOne({
    _id: body.VehicleID,
    ...getOrgScopeFilter(req)
  }).lean();
  if (!vehicle) throw new ApiError(404, "Vehicle not found");

  // Driver (optional) — phải cùng org subtree
  let driver = null;
  if (body.DriverID) {
    driver = await Driver.findOne({
      _id: body.DriverID,
      ...getOrgScopeFilter(req)
    }).lean();
    if (!driver) throw new ApiError(404, "Driver not found");
  }

  const doc = await VehicleMaintenance.create({
    OrganizationID: vehicle.OrganizationID,
    VehicleID: vehicle._id,
    DriverID: driver?._id ?? null,
    DriverCode: driver?.DriverCode ?? "",
    DriverName: driver?.XName ?? "",
    VehicleCode: vehicle.VehicleCode,
    Type: body.Type,
    Title: body.Title,
    Description: body.Description ?? "",
    ScheduledDate: new Date(body.ScheduledDate),
    OdometerAtService: Number(body.OdometerAtService) || 0,
    NextServiceOdometer: Number(body.NextServiceOdometer) || 0,
    NextServiceDate: body.NextServiceDate ? new Date(body.NextServiceDate) : null,
    Cost: Number(body.Cost) || 0,
    Vendor: body.Vendor ?? "",
    Status: body.Status ?? MaintenanceStatus.SCHEDULED,
    Notes: body.Notes ?? "",
    CreatedBy: req.user?._id ?? null
  });

  // Gửi notification nếu có tài xế được gán
  if (driver) {
    notifyDriverMaintenance(doc, driver, "assigned").catch(() => {});
  }

  res.status(201).json({ success: true, data: doc });
}

export async function updateMaintenance(req, res) {
  const doc = await VehicleMaintenance.findOne({ _id: req.params.id, ...getOrgScopeFilter(req) });
  if (!doc) throw new ApiError(404, "Maintenance record not found");

  const allowed = ["Type", "Title", "Description", "ScheduledDate", "CompletedDate", "OdometerAtService", "NextServiceOdometer", "NextServiceDate", "Cost", "Vendor", "Status", "Notes"];
  for (const k of allowed) {
    if (req.body[k] !== undefined) {
      doc[k] = ["ScheduledDate", "CompletedDate", "NextServiceDate"].includes(k) && req.body[k]
        ? new Date(req.body[k])
        : req.body[k];
    }
  }

  // Driver update (cho phép null để clear) — track xem có thay đổi để gửi notification
  const prevDriverId = doc.DriverID ? String(doc.DriverID) : null;
  let newDriver = null;
  if (req.body.DriverID !== undefined) {
    if (req.body.DriverID === null || req.body.DriverID === "") {
      doc.DriverID = null;
      doc.DriverCode = "";
      doc.DriverName = "";
    } else {
      newDriver = await Driver.findOne({
        _id: req.body.DriverID,
        ...getOrgScopeFilter(req)
      }).lean();
      if (!newDriver) throw new ApiError(404, "Driver not found");
      doc.DriverID = newDriver._id;
      doc.DriverCode = newDriver.DriverCode ?? "";
      doc.DriverName = newDriver.XName ?? "";
    }
  }

  // Tự set CompletedDate khi đánh dấu COMPLETED
  if (req.body.Status === MaintenanceStatus.COMPLETED && !doc.CompletedDate) {
    doc.CompletedDate = new Date();
  }

  await doc.save();

  // Gửi notification nếu driver mới khác driver cũ
  if (newDriver && String(newDriver._id) !== prevDriverId) {
    notifyDriverMaintenance(doc, newDriver, "assigned").catch(() => {});
  }

  res.json({ success: true, data: doc });
}

export async function deleteMaintenance(req, res) {
  const result = await VehicleMaintenance.deleteOne({ _id: req.params.id, ...getOrgScopeFilter(req) });
  if (result.deletedCount === 0) throw new ApiError(404, "Maintenance record not found");
  res.json({ success: true, data: { deleted: true } });
}

/**
 * GET /api/maintenance/alerts
 *
 * Tính toán các xe cần cảnh báo bảo dưỡng:
 *  - Có lịch SCHEDULED trong vòng 7 ngày tới
 *  - Tổng quãng đường xe đã chạy (từ Trip.TotalDistance) gần đạt NextServiceOdometer
 */
export async function maintenanceAlerts(req, res) {
  const orgFilter = getOrgScopeFilter(req);
  const now = new Date();
  const in7d = new Date(now.getTime() + 7 * 24 * 3600 * 1000);

  // 1. Lịch sắp tới
  const upcoming = await VehicleMaintenance.find({
    ...orgFilter,
    Status: { $in: [MaintenanceStatus.SCHEDULED, MaintenanceStatus.IN_PROGRESS] },
    ScheduledDate: { $gte: now, $lte: in7d }
  }).sort({ ScheduledDate: 1 }).lean();

  // 2. Lịch QUÁ HẠN
  const overdue = await VehicleMaintenance.find({
    ...orgFilter,
    Status: { $in: [MaintenanceStatus.SCHEDULED, MaintenanceStatus.IN_PROGRESS] },
    ScheduledDate: { $lt: now }
  }).sort({ ScheduledDate: 1 }).lean();

  // 3. Xe có km gần đến hạn — aggregate dùng find trước để lọc theo org (tránh
  // bug cast string ObjectId trong $match khi orgFilter dùng scopeFilter)
  const candidateRecords = await VehicleMaintenance.find({
    ...orgFilter,
    NextServiceOdometer: { $gt: 0 }
  }).sort({ ScheduledDate: -1 }).lean();

  // Lấy bản ghi mới nhất per vehicle
  const seenVehicles = new Set();
  const lastByVehicle = [];
  for (const r of candidateRecords) {
    const key = String(r.VehicleID);
    if (seenVehicles.has(key)) continue;
    seenVehicles.add(key);
    lastByVehicle.push({ record: r });
  }

  // Tổng km từ Trip — dùng find rồi reduce thay vì aggregate (tránh cast issue)
  const completedTrips = await Trip.find({
    ...orgFilter,
    Status: "COMPLETED"
  }).select("VehicleID TotalDistance").lean();
  const tripStats = [];
  const kmMap = new Map();
  for (const t of completedTrips) {
    const key = String(t.VehicleID);
    kmMap.set(key, (kmMap.get(key) ?? 0) + (t.TotalDistance ?? 0));
  }
  for (const [k, v] of kmMap.entries()) tripStats.push({ _id: k, totalKm: v });
  const kmByVehicle = new Map(tripStats.map((s) => [String(s._id), s.totalKm]));

  const odometerWarnings = [];
  for (const { record } of lastByVehicle) {
    const currentKm = kmByVehicle.get(String(record.VehicleID)) || 0;
    const remaining = record.NextServiceOdometer - currentKm;
    if (remaining <= 500) {
      odometerWarnings.push({
        vehicleId: record.VehicleID,
        vehicleCode: record.VehicleCode,
        currentKm,
        targetKm: record.NextServiceOdometer,
        remainingKm: remaining,
        lastService: record.Title,
        severity: remaining <= 0 ? "CRITICAL" : "WARNING"
      });
    }
  }

  res.json({
    success: true,
    data: {
      upcoming,
      overdue,
      odometerWarnings,
      summary: {
        upcomingCount: upcoming.length,
        overdueCount: overdue.length,
        odometerWarningCount: odometerWarnings.length
      }
    }
  });
}
