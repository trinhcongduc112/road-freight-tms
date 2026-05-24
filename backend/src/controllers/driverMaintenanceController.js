import { VehicleMaintenance, MaintenanceStatus } from "../models/VehicleMaintenance.js";
import { Driver } from "../models/Driver.js";
import { ApiError } from "../utils/apiError.js";

async function getMyDriverId(req) {
  // Tài xế login mobile = User có LinkedDriverID hoặc Driver.LinkedUserID = user._id
  const driver = await Driver.findOne({ LinkedUserID: req.user._id }).lean();
  return driver?._id ?? null;
}

/**
 * GET /api/driver/maintenance
 * Liệt kê các maintenance đã gán cho tài xế hiện tại.
 */
export async function listMyMaintenance(req, res) {
  const driverId = await getMyDriverId(req);
  if (!driverId) return res.json({ success: true, data: { items: [] } });

  const filter = { DriverID: driverId };
  if (req.query.activeOnly === "true" || req.query.activeOnly === "1") {
    filter.Status = { $nin: [MaintenanceStatus.COMPLETED, MaintenanceStatus.CANCELLED] };
  }

  const items = await VehicleMaintenance.find(filter).sort({ ScheduledDate: -1 }).lean();
  res.json({ success: true, data: { items } });
}

/**
 * GET /api/driver/maintenance/:id
 */
export async function getMyMaintenance(req, res) {
  const driverId = await getMyDriverId(req);
  if (!driverId) throw new ApiError(403, "Tài khoản chưa link với tài xế");

  const doc = await VehicleMaintenance.findOne({ _id: req.params.id, DriverID: driverId }).lean();
  if (!doc) throw new ApiError(404, "Không tìm thấy lịch bảo dưỡng");
  res.json({ success: true, data: doc });
}

/**
 * POST /api/driver/maintenance/:id/acknowledge
 * Tài xế xác nhận đã nhận việc.
 */
export async function acknowledgeMaintenance(req, res) {
  const driverId = await getMyDriverId(req);
  if (!driverId) throw new ApiError(403, "Tài khoản chưa link với tài xế");

  const doc = await VehicleMaintenance.findOne({ _id: req.params.id, DriverID: driverId });
  if (!doc) throw new ApiError(404, "Không tìm thấy lịch bảo dưỡng");
  if (doc.Status === MaintenanceStatus.COMPLETED || doc.Status === MaintenanceStatus.CANCELLED) {
    throw new ApiError(409, "Lịch bảo dưỡng đã kết thúc, không thể nhận lại");
  }

  doc.DriverAcknowledgedAt = new Date();
  if (doc.Status === MaintenanceStatus.SCHEDULED) {
    doc.Status = MaintenanceStatus.ACKNOWLEDGED;
  }
  await doc.save();
  res.json({ success: true, data: doc });
}

/**
 * POST /api/driver/maintenance/:id/complete
 * Body: { photos: [base64...], note: string }
 * Tài xế đánh dấu hoàn thành + upload ảnh hoá đơn → chờ dispatcher duyệt.
 */
export async function completeMaintenance(req, res) {
  const driverId = await getMyDriverId(req);
  if (!driverId) throw new ApiError(403, "Tài khoản chưa link với tài xế");

  const doc = await VehicleMaintenance.findOne({ _id: req.params.id, DriverID: driverId });
  if (!doc) throw new ApiError(404, "Không tìm thấy lịch bảo dưỡng");
  if (doc.Status === MaintenanceStatus.COMPLETED || doc.Status === MaintenanceStatus.CANCELLED) {
    throw new ApiError(409, "Lịch bảo dưỡng đã kết thúc");
  }

  const photos = Array.isArray(req.body?.photos) ? req.body.photos : [];
  if (photos.length === 0) {
    throw new ApiError(400, "Phải chụp ít nhất 1 ảnh hoá đơn / xe sau bảo dưỡng");
  }
  const note = String(req.body?.note ?? "").trim();

  doc.CompletionPhotos = photos;
  doc.CompletionNote = note;
  doc.DriverCompletedAt = new Date();
  doc.Status = MaintenanceStatus.AWAITING_REVIEW;
  if (!doc.DriverAcknowledgedAt) doc.DriverAcknowledgedAt = new Date();
  await doc.save();

  res.json({ success: true, data: doc });
}
