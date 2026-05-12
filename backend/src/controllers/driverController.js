import { DeliveryRoute, RouteStatus, StopStatus } from "../models/DeliveryRoute.js";
import { SalesOrder, OrderStatus } from "../models/SalesOrder.js";
import { ApiError } from "../utils/apiError.js";

// Lấy danh sách các chuyến xe được giao cho tài xế đang đăng nhập
export async function getMyRoutes(req, res) {
  // Tìm các chuyến có DriverID = req.user._id và Status = FINALIZED (đã chốt)
  const routes = await DeliveryRoute.find({
    DriverID: req.user._id,
    Status: RouteStatus.FINALIZED
  })
    .sort({ createdAt: -1 })
    .populate("RoutePlanID", "PlanCode Date")
    .lean();

  res.json({ success: true, data: routes });
}

// Lấy chi tiết một chuyến xe
export async function getRouteDetail(req, res) {
  const route = await DeliveryRoute.findOne({
    _id: req.params.id,
    DriverID: req.user._id
  })
    .populate("RoutePlanID", "PlanCode Date")
    .lean();

  if (!route) throw new ApiError(404, "Route not found or unauthorized");
  
  // Tùy chọn: Populate thêm thông tin SalesOrder cho các stops
  for (const stop of route.Stops) {
    const orders = await SalesOrder.find({ _id: { $in: stop.OrderIDs } }).lean();
    stop.Orders = orders;
  }

  res.json({ success: true, data: route });
}

// Cập nhật trạng thái điểm dừng (ví dụ: xác nhận giao hàng / ePOD)
export async function updateStopStatus(req, res) {
  const { id, stopIndex } = req.params;
  const { status, note, lastResponse } = req.body; // status = COMPLETED, FAILED, IN_PROGRESS

  if (!Object.values(StopStatus).includes(status)) {
    throw new ApiError(400, "Invalid stop status");
  }

  const route = await DeliveryRoute.findOne({
    _id: id,
    DriverID: req.user._id
  });

  if (!route) throw new ApiError(404, "Route not found or unauthorized");

  const stop = route.Stops.find(s => s.StopIndex === parseInt(stopIndex, 10));
  if (!stop) throw new ApiError(404, "Stop not found");

  stop.StopStatus = status;
  if (note) stop.FailureReason = note;

  // Lấy ý tưởng từ dự án Abivin: Xử lý Base64 ePOD từ mảng entities động
  if (lastResponse && lastResponse.entities) {
    let signatureData = "";
    let images = [];
    
    for (const entity of lastResponse.entities) {
      if (Array.isArray(entity.data)) {
        for (const d of entity.data) {
          if (typeof d.value === "string" && d.value.startsWith("data:image/")) {
            if (entity.type === "SIGNATURE") signatureData = d.value;
            if (entity.type === "PHOTO") images.push(d.value);
          }
        }
      }
    }
    
    if (signatureData) stop.EpodSignature = signatureData;
    if (images.length > 0) stop.EpodImages = images;
  }
  
  await route.save();

  // Nếu điểm dừng có đơn hàng, cập nhật trạng thái đơn hàng luôn
  if (status === StopStatus.COMPLETED) {
    await SalesOrder.updateMany(
      { _id: { $in: stop.OrderIDs } },
      { $set: { OrderStatus: OrderStatus.DELIVERED } }
    );
  }

  res.json({ success: true, data: route });
}
