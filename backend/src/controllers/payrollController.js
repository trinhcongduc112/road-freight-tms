import { Trip } from "../models/Trip.js";
import { Driver } from "../models/Driver.js";
import { PayrollConfig, DEFAULT_PAYROLL_CONFIG, loadPayrollConfig } from "../models/PayrollConfig.js";
import { scopeFilter } from "../middlewares/dac.js";
import { ApiError } from "../utils/apiError.js";

/**
 * GET /api/payroll/drivers
 * Query: month (YYYY-MM), driverId?
 *
 * Trả bảng lương + commission tài xế theo tháng.
 * Công thức (giả định doanh nghiệp logistics VN phổ biến):
 *   - Lương cứng: 8.000.000 VND / tháng (config)
 *   - Phụ cấp / km vượt: +500 VND / km vượt mức 1000km/tháng
 *   - Thưởng hoàn thành: 50.000 VND / chuyến COMPLETED
 *   - % COD thu hộ: 0.5% trên tổng COD đã thu
 *
 * Lưu ý: KHÔNG phạt chuyến huỷ — nguyên nhân huỷ thường do planner
 * (lập sai), khách (đổi ý), hoặc lỗi vận hành, không phải lỗi tài xế.
 * Phạt huỷ chỉ áp dụng khi xác định được "no-show" / "từ chối nhận chuyến"
 * — cần model thêm CancelReason / CancelledBy mới triển khai chuẩn được.
 */

function primaryOrgId(req) {
  return req.role?.OrganizationID ?? req.user?.OrganizationIDs?.[0] ?? null;
}

/**
 * GET /api/payroll/config — lấy cấu hình lương hiện tại của org
 */
export async function getPayrollConfig(req, res) {
  const orgId = primaryOrgId(req);
  const cfg = await loadPayrollConfig(orgId);
  res.json({
    success: true,
    data: {
      orgId,
      config: cfg,
      defaults: DEFAULT_PAYROLL_CONFIG
    }
  });
}

/**
 * PUT /api/payroll/config — cập nhật cấu hình lương cho org
 * Body: { BaseSalary, KmThreshold, PerKmBonus, PerCompletedTrip, CodCommissionRate }
 */
export async function updatePayrollConfig(req, res) {
  const orgId = primaryOrgId(req);
  if (!orgId) throw new ApiError(400, "OrganizationID required");

  const body = req.body ?? {};
  const update = {};
  for (const key of ["BaseSalary", "KmThreshold", "PerKmBonus", "PerCompletedTrip", "CodCommissionRate"]) {
    if (body[key] !== undefined) {
      const v = Number(body[key]);
      if (Number.isNaN(v) || v < 0) throw new ApiError(400, `${key} must be a non-negative number`);
      if (key === "CodCommissionRate" && v > 1) throw new ApiError(400, "CodCommissionRate phải ≤ 1 (vd: 0.005 = 0.5%)");
      update[key] = v;
    }
  }
  update.UpdatedBy = req.user?._id ?? null;

  const doc = await PayrollConfig.findOneAndUpdate(
    { OrganizationID: orgId },
    { $set: update, $setOnInsert: { OrganizationID: orgId } },
    { new: true, upsert: true }
  );

  res.json({ success: true, data: doc });
}

export async function driverPayroll(req, res) {
  const orgId = primaryOrgId(req);
  // Load config từ DB (nếu chưa có sẽ dùng default)
  const dbCfg = await loadPayrollConfig(orgId);
  const PAYROLL_CONFIG = {
    baseSalary: dbCfg.BaseSalary,
    kmThreshold: dbCfg.KmThreshold,
    perKmBonus: dbCfg.PerKmBonus,
    perCompletedTrip: dbCfg.PerCompletedTrip,
    codCommissionRate: dbCfg.CodCommissionRate
  };

  const monthStr = String(req.query.month ?? "").trim() || new Date().toISOString().slice(0, 7);
  const [yearStr, monStr] = monthStr.split("-");
  const year = Number(yearStr);
  const mon = Number(monStr);
  if (!year || !mon || mon < 1 || mon > 12) {
    return res.status(400).json({ success: false, error: "month phải có dạng YYYY-MM" });
  }
  const start = new Date(Date.UTC(year, mon - 1, 1));
  const end = new Date(Date.UTC(year, mon, 1));

  // Expand toàn bộ subtree org (admin parent thấy được sub-org)
  const orgFilter = scopeFilter(req.orgScope, "OrganizationID");
  // Chỉ tính lương cho tài xế NỘI BỘ — tài xế 3PL hưởng lương từ hãng họ, chi phí
  // đã được tính qua bảng giá Service ở Route Plan / Trip cost. Bao gồm cả document
  // legacy không có EmploymentType (mặc định coi như IN_HOUSE).
  const driverFilter = {
    ...orgFilter,
    Status: "Active",
    $or: [
      { EmploymentType: "IN_HOUSE" },
      { EmploymentType: { $exists: false } }
    ]
  };
  if (req.query.driverId) driverFilter._id = req.query.driverId;
  const drivers = await Driver.find(driverFilter).lean();

  // Đếm tài xế 3PL bị loại để hiển thị thông báo trên UI
  const outsourcedCount = await Driver.countDocuments({
    ...orgFilter,
    Status: "Active",
    EmploymentType: "OUTSOURCED"
  });

  // DriverID array đã giới hạn bởi org scope ở trên → không cần filter OrgID nữa
  // (Trip.aggregate $match KHÔNG auto-cast string → ObjectId như Mongoose find)
  const tripFilter = {
    DriverID: { $in: drivers.map((d) => d._id) },
    PlanDate: { $gte: start, $lt: end }
  };

  const stats = await Trip.aggregate([
    { $match: tripFilter },
    {
      $group: {
        _id: "$DriverID",
        totalTrips: { $sum: 1 },
        completed: { $sum: { $cond: [{ $eq: ["$Status", "COMPLETED"] }, 1, 0] } },
        cancelled: { $sum: { $cond: [{ $eq: ["$Status", "CANCELLED"] }, 1, 0] } },
        totalDistance: { $sum: "$TotalDistance" },
        totalCOD: { $sum: "$TotalCODCollected" }
      }
    }
  ]);
  const statByDriver = new Map(stats.map((s) => [String(s._id), s]));

  const items = drivers.map((d) => {
    const s = statByDriver.get(String(d._id)) ?? {
      totalTrips: 0,
      completed: 0,
      cancelled: 0,
      totalDistance: 0,
      totalCOD: 0
    };

    const kmBonus = Math.max(0, s.totalDistance - PAYROLL_CONFIG.kmThreshold) * PAYROLL_CONFIG.perKmBonus;
    const completionBonus = s.completed * PAYROLL_CONFIG.perCompletedTrip;
    const codCommission = Math.round(s.totalCOD * PAYROLL_CONFIG.codCommissionRate);
    const gross = PAYROLL_CONFIG.baseSalary + kmBonus + completionBonus + codCommission;

    return {
      driverID: d._id,
      driverCode: d.DriverCode,
      driverName: d.XName,
      phone: d.Phone,
      stats: {
        totalTrips: s.totalTrips,
        completed: s.completed,
        cancelled: s.cancelled,
        totalDistanceKm: Math.round(s.totalDistance * 10) / 10,
        totalCOD: s.totalCOD
      },
      breakdown: {
        baseSalary: PAYROLL_CONFIG.baseSalary,
        kmBonus,
        completionBonus,
        codCommission
      },
      gross
    };
  });

  // Sort by gross desc
  items.sort((a, b) => b.gross - a.gross);

  const totals = items.reduce(
    (acc, x) => {
      acc.baseSalary += x.breakdown.baseSalary;
      acc.kmBonus += x.breakdown.kmBonus;
      acc.completionBonus += x.breakdown.completionBonus;
      acc.codCommission += x.breakdown.codCommission;
      acc.gross += x.gross;
      return acc;
    },
    { baseSalary: 0, kmBonus: 0, completionBonus: 0, codCommission: 0, gross: 0 }
  );

  res.json({
    success: true,
    data: {
      month: monthStr,
      config: PAYROLL_CONFIG,
      driverCount: items.length,
      outsourcedExcluded: outsourcedCount,
      items,
      totals
    }
  });
}
