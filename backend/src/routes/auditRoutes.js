import { Router } from "express";
import { authenticate } from "../middlewares/auth.js";
import { attachOrgScope } from "../middlewares/dac.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { listAuditLogs, auditSummary } from "../controllers/auditController.js";

export const auditRouter = Router();
auditRouter.use(authenticate, attachOrgScope);

/**
 * @openapi
 * /api/audit-logs:
 *   get:
 *     tags: [System]
 *     summary: Liệt kê audit log (ai làm gì, khi nào)
 *     parameters:
 *       - in: query
 *         name: action
 *         schema: { type: string, enum: [CREATE, UPDATE, DELETE, LOGIN, LOGOUT, EXPORT] }
 *       - in: query
 *         name: resource
 *         schema: { type: string }
 *       - in: query
 *         name: userId
 *         schema: { type: string }
 *       - in: query
 *         name: from
 *         schema: { type: string, format: date-time }
 *       - in: query
 *         name: to
 *         schema: { type: string, format: date-time }
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 50, maximum: 200 }
 *     responses:
 *       200: { description: Trả danh sách log phân trang }
 *       401: { description: Cần đăng nhập }
 */
auditRouter.get("/", asyncHandler(listAuditLogs));

/**
 * @openapi
 * /api/audit-logs/summary:
 *   get:
 *     tags: [System]
 *     summary: Tóm tắt audit log 24h gần nhất
 *     responses:
 *       200: { description: byAction + byResource counts }
 */
auditRouter.get("/summary", asyncHandler(auditSummary));
