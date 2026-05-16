import { Router } from "express";
import { authenticate } from "../middlewares/auth.js";
import { attachOrgScope } from "../middlewares/dac.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import * as ctrl from "../controllers/maintenanceController.js";

export const maintenanceRouter = Router();
maintenanceRouter.use(authenticate, attachOrgScope);

/**
 * @openapi
 * /api/maintenance/alerts:
 *   get:
 *     tags: [System]
 *     summary: Cảnh báo bảo dưỡng (sắp tới hạn, quá hạn, sắp đạt km)
 *     responses:
 *       200: { description: Trả về upcoming + overdue + odometerWarnings }
 */
maintenanceRouter.get("/alerts", asyncHandler(ctrl.maintenanceAlerts));

/**
 * @openapi
 * /api/maintenance:
 *   get:
 *     tags: [Master Data]
 *     summary: Liệt kê lịch bảo dưỡng (phân trang)
 *     responses:
 *       200: { description: Danh sách maintenance records }
 *   post:
 *     tags: [Master Data]
 *     summary: Tạo lịch bảo dưỡng cho 1 xe
 *     responses:
 *       201: { description: Tạo thành công }
 */
maintenanceRouter.get("/", asyncHandler(ctrl.listMaintenance));
maintenanceRouter.post("/", asyncHandler(ctrl.createMaintenance));

/**
 * @openapi
 * /api/maintenance/{id}:
 *   put:
 *     tags: [Master Data]
 *     summary: Cập nhật bản ghi bảo dưỡng (đánh dấu hoàn tất, sửa chi phí...)
 *   delete:
 *     tags: [Master Data]
 *     summary: Xóa bản ghi bảo dưỡng
 */
maintenanceRouter.put("/:id", asyncHandler(ctrl.updateMaintenance));
maintenanceRouter.delete("/:id", asyncHandler(ctrl.deleteMaintenance));
