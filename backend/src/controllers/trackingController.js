import { SalesOrder, OrderStatus } from "../models/SalesOrder.js";
import { Trip } from "../models/Trip.js";
import { ApiError } from "../utils/apiError.js";

/**
 * GET /api/track/:orderCode
 *
 * PUBLIC endpoint — KHÔNG cần đăng nhập. Khách hàng dán mã đơn → xem:
 *  - Trạng thái đơn hàng + timeline
 *  - Vị trí xe realtime (nếu đang vận chuyển)
 *  - ETA dự kiến
 *  - Tên + SĐT tài xế (để khách liên hệ)
 *  - Ảnh ePOD sau khi giao thành công
 *
 * Bảo mật: chỉ trả thông tin tối thiểu (không lộ giá, không lộ khách khác).
 * Mã đơn coi như "secret-by-obscurity" giống FedEx tracking.
 */
export async function trackByOrderCode(req, res) {
  const code = String(req.params.orderCode ?? "").trim().toUpperCase();
  if (!code) throw new ApiError(400, "orderCode is required");
  if (code.length > 32) throw new ApiError(400, "orderCode quá dài");

  const order = await SalesOrder.findOne({ OrderCode: code }).lean();
  if (!order) throw new ApiError(404, "Không tìm thấy đơn hàng");

  // Tìm trip chứa order này (nếu đã lên kế hoạch)
  const trip = await Trip.findOne({
    OrganizationID: order.OrganizationID,
    "Tasks.OrderCodes": code
  }).lean();

  // Timeline lấy từ StatusHistory
  const timeline = (order.StatusHistory ?? []).map((h) => ({
    status: h.ToStatus,
    at: h.ChangedAt,
    note: h.Note ?? ""
  }));

  let tripInfo = null;
  if (trip) {
    // Tìm task tương ứng order code này
    const task = (trip.Tasks ?? []).find((t) =>
      (t.OrderCodes ?? []).includes(code)
    );

    tripInfo = {
      tripCode: trip.TripCode,
      status: trip.Status,
      plannedStart: trip.PlannedStartTime,
      startedAt: trip.StartedAt,
      completedAt: trip.CompletedAt,
      driver: trip.DriverName ? {
        name: trip.DriverName,
        phone: trip.DriverPhone || null
      } : null,
      vehicle: trip.VehicleCode || null,
      currentLocation: trip.LastGpsAt && trip.LastLatitude && trip.LastLongitude ? {
        latitude: trip.LastLatitude,
        longitude: trip.LastLongitude,
        speed: trip.LastSpeed || 0,
        updatedAt: trip.LastGpsAt
      } : null,
      stop: task ? {
        index: task.StopIndex,
        address: task.Address,
        plannedArrival: task.PlannedArrivalTime,
        status: task.Status,
        arrivedAt: task.ArrivedAt,
        completedAt: task.CompletedAt,
        failedAt: task.FailedAt,
        failureReason: task.FailureReason || "",
        podImages: task.PodImages ?? [],
        signature: task.SignatureImage || null,
        codAmount: task.CODAmount || 0,
        cashCollected: task.CashCollected || 0
      } : null
    };
  }

  // ETA đơn giản: nếu trip đang IN_PROGRESS + có planned arrival → trả về
  let eta = null;
  if (tripInfo?.status === "IN_PROGRESS" && tripInfo.stop?.plannedArrival) {
    eta = {
      plannedAt: tripInfo.stop.plannedArrival,
      label: `Dự kiến giao lúc ${tripInfo.stop.plannedArrival}`
    };
  } else if (tripInfo?.status === "ASSIGNED" || tripInfo?.status === "DRIVER_CONFIRMED") {
    eta = { label: "Đang chuẩn bị xuất kho" };
  } else if (tripInfo?.status === "COMPLETED") {
    eta = { label: "Đã giao hàng thành công" };
  }

  res.json({
    success: true,
    data: {
      order: {
        code: order.OrderCode,
        status: order.OrderStatus,
        date: order.OrderDate,
        timeWindow: order.TimeWindow || ""
      },
      timeline,
      trip: tripInfo,
      eta,
      lastUpdated: new Date()
    }
  });
}
