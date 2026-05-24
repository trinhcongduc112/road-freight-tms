import { Router } from "express";
import { authenticate } from "../middlewares/auth.js";
import { attachOrgScope } from "../middlewares/dac.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { driverPayroll, getPayrollConfig, updatePayrollConfig } from "../controllers/payrollController.js";

export const payrollRouter = Router();
payrollRouter.use(authenticate, attachOrgScope);

/**
 * @openapi
 * /api/payroll/drivers:
 *   get:
 *     tags: [Reports]
 *     summary: Bảng lương + commission tài xế theo tháng
 *     parameters:
 *       - in: query
 *         name: month
 *         schema: { type: string, example: "2026-05" }
 *       - in: query
 *         name: driverId
 *         schema: { type: string }
 *     responses:
 *       200: { description: Lương từng tài xế + tổng }
 */
payrollRouter.get("/drivers", asyncHandler(driverPayroll));

/**
 * @openapi
 * /api/payroll/config:
 *   get:
 *     tags: [Reports]
 *     summary: Lấy cấu hình lương hiện tại của tổ chức
 *   put:
 *     tags: [Reports]
 *     summary: Cập nhật cấu hình lương (lương cứng, thưởng km/chuyến, % COD)
 */
payrollRouter.get("/config", asyncHandler(getPayrollConfig));
payrollRouter.put("/config", asyncHandler(updatePayrollConfig));
