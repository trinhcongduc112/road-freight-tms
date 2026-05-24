/**
 * In-app notification service.
 *
 * Tạo notification trong DB + emit Socket.IO realtime cho user (web/mobile).
 * Dùng cho: gán bảo dưỡng cho TX, chuyến mới, trạng thái thay đổi...
 *
 * SMS/Zalo gửi khách hàng đã được loại bỏ — không khả thi trong môi trường
 * dev/demo (Zalo OA cần verified business + khách phải follow OA; SMS cần
 * brandname approve 3-7 ngày). Khách hàng dùng tracking portal `/track/:code`
 * — planner copy link share qua kênh riêng (Zalo cá nhân, email...).
 */
import { logger } from "../utils/logger.js";
import { Notification, NotificationType } from "../models/Notification.js";
import { getIO } from "../socket.js";

/**
 * Tạo in-app notification cho 1 User + emit Socket.IO realtime.
 *
 * @param {object} params
 * @param {string|ObjectId} params.userId      User._id nhận thông báo
 * @param {string|ObjectId} [params.orgId]     OrganizationID context
 * @param {string} params.type                 NotificationType
 * @param {string} params.title                Tiêu đề ngắn
 * @param {string} [params.body]               Nội dung chi tiết
 * @param {string} [params.link]               Deep-link (vd "maintenance:<id>")
 * @param {object} [params.metadata]           Payload tuỳ ý
 * @returns {Promise<object>} document đã tạo
 */
export async function createInAppNotification({ userId, orgId, type, title, body, link, metadata }) {
  if (!userId || !title) {
    logger.warn("[notify] createInAppNotification: thiếu userId hoặc title");
    return null;
  }

  const doc = await Notification.create({
    UserID: userId,
    OrganizationID: orgId ?? null,
    Type: type || NotificationType.GENERAL,
    Title: title,
    Body: body || "",
    Link: link || "",
    Metadata: metadata || null
  });

  // Emit realtime tới room user — mobile/web đang mở app nhận ngay
  try {
    const io = getIO();
    if (io) {
      io.to(`user_${String(userId)}`).emit("notification:new", {
        _id: doc._id,
        type: doc.Type,
        title: doc.Title,
        body: doc.Body,
        link: doc.Link,
        metadata: doc.Metadata,
        createdAt: doc.CreatedAt
      });
    }
  } catch (e) {
    logger.warn(`[notify] socket emit failed: ${e.message}`);
  }

  return doc;
}
