import { Router } from "express";
import { trackingRateLimiter } from "../middlewares/rateLimit.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { trackByOrderCode } from "../controllers/trackingController.js";

export const trackingRouter = Router();

/**
 * @openapi
 * /api/track/{orderCode}:
 *   get:
 *     tags: [Tracking]
 *     security: []
 *     summary: Tra cứu trạng thái đơn hàng (public, không cần đăng nhập)
 *     description: |
 *       Khách hàng dán mã đơn nhận được qua SMS/Zalo để xem trạng thái real-time:
 *       - Vị trí xe trên bản đồ
 *       - ETA + tài xế + SĐT
 *       - Timeline trạng thái
 *       - Ảnh ePOD sau khi giao
 *     parameters:
 *       - in: path
 *         name: orderCode
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200: { description: Thông tin tracking }
 *       404: { description: Không tìm thấy đơn }
 *       429: { description: Vượt giới hạn tra cứu }
 */
trackingRouter.get("/:orderCode", trackingRateLimiter, asyncHandler(trackByOrderCode));
