import { Notification } from "../models/Notification.js";
import { ApiError } from "../utils/apiError.js";

/**
 * GET /api/driver/notifications
 * Query: page, limit, unreadOnly
 */
export async function listMyNotifications(req, res) {
  const userId = req.user?._id;
  if (!userId) throw new ApiError(401, "Not authenticated");

  const filter = { UserID: userId };
  if (req.query.unreadOnly === "true" || req.query.unreadOnly === "1") {
    filter.IsRead = false;
  }

  const page = Math.max(1, Number(req.query.page) || 1);
  const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 30));
  const skip = (page - 1) * limit;

  const [items, total, unread] = await Promise.all([
    Notification.find(filter).sort({ CreatedAt: -1 }).skip(skip).limit(limit).lean(),
    Notification.countDocuments(filter),
    Notification.countDocuments({ UserID: userId, IsRead: false })
  ]);

  res.json({ success: true, data: { items, total, page, limit, unread } });
}

/**
 * GET /api/driver/notifications/unread-count
 * Trả số notification chưa đọc — dùng cho badge.
 */
export async function unreadCount(req, res) {
  const userId = req.user?._id;
  if (!userId) throw new ApiError(401, "Not authenticated");
  const count = await Notification.countDocuments({ UserID: userId, IsRead: false });
  res.json({ success: true, data: { count } });
}

/**
 * PATCH /api/driver/notifications/:id/read
 */
export async function markRead(req, res) {
  const userId = req.user?._id;
  const doc = await Notification.findOneAndUpdate(
    { _id: req.params.id, UserID: userId },
    { $set: { IsRead: true, ReadAt: new Date() } },
    { new: true }
  );
  if (!doc) throw new ApiError(404, "Notification not found");
  res.json({ success: true, data: doc });
}

/**
 * PATCH /api/driver/notifications/mark-all-read
 */
export async function markAllRead(req, res) {
  const userId = req.user?._id;
  const result = await Notification.updateMany(
    { UserID: userId, IsRead: false },
    { $set: { IsRead: true, ReadAt: new Date() } }
  );
  res.json({ success: true, data: { modified: result.modifiedCount } });
}
