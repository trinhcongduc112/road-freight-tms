import { AuditLog } from "../models/AuditLog.js";
import { scopeFilter } from "../middlewares/dac.js";

/**
 * GET /api/audit-logs
 * Query: action, resource, userId, from, to, page, limit
 * Trả danh sách audit log theo phạm vi org của user (bao gồm sub-org nếu admin).
 */
export async function listAuditLogs(req, res) {
  // Dùng scopeFilter để expand cả các sub-org (admin của parent thấy được con)
  const filter = scopeFilter(req.orgScope, "OrganizationID");

  if (req.query.action) filter.Action = String(req.query.action).toUpperCase();
  if (req.query.resource) filter.Resource = req.query.resource;
  if (req.query.userId) filter.UserID = req.query.userId;
  if (req.query.from || req.query.to) {
    filter.CreatedAt = {};
    if (req.query.from) filter.CreatedAt.$gte = new Date(req.query.from);
    if (req.query.to) filter.CreatedAt.$lte = new Date(req.query.to);
  }

  const page = Math.max(1, Number(req.query.page) || 1);
  const limit = Math.min(200, Math.max(1, Number(req.query.limit) || 50));
  const skip = (page - 1) * limit;

  const [items, total] = await Promise.all([
    AuditLog.find(filter).sort({ CreatedAt: -1 }).skip(skip).limit(limit).lean(),
    AuditLog.countDocuments(filter)
  ]);

  res.json({ success: true, data: { items, total, page, limit } });
}

/**
 * GET /api/audit-logs/summary
 * Trả thống kê 24h gần nhất: số action theo loại.
 */
export async function auditSummary(req, res) {
  const match = {
    CreatedAt: { $gte: new Date(Date.now() - 24 * 3600 * 1000) },
    ...scopeFilter(req.orgScope, "OrganizationID")
  };

  const byAction = await AuditLog.aggregate([
    { $match: match },
    { $group: { _id: "$Action", count: { $sum: 1 } } },
    { $sort: { count: -1 } }
  ]);
  const byResource = await AuditLog.aggregate([
    { $match: match },
    { $group: { _id: "$Resource", count: { $sum: 1 } } },
    { $sort: { count: -1 } },
    { $limit: 10 }
  ]);

  res.json({
    success: true,
    data: {
      since: new Date(Date.now() - 24 * 3600 * 1000),
      total: byAction.reduce((s, x) => s + x.count, 0),
      byAction,
      byResource
    }
  });
}
