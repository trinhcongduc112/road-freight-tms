import { Driver } from "../models/Driver.js";
import { Trip } from "../models/Trip.js";
import { Vehicle } from "../models/Vehicle.js";
import { DeliveryRoute } from "../models/DeliveryRoute.js";
import { RoutePlan } from "../models/RoutePlan.js";

/**
 * Auto-dispatch service — chấm điểm tài xế và tự động gán cho các tuyến chưa có người.
 *
 * Algorithm: weighted scoring
 *   score = w1 * (1 / (1 + tripsThisWeek))           // workload — ít việc → điểm cao
 *         + w2 * completionRate                       // tỷ lệ hoàn thành (0..1)
 *         + w3 * seniorityScore                       // thâm niên (createdAt cũ hơn → cao hơn)
 *         + w4 * vehicleMatchBonus                    // khớp loại xe
 *
 * Trade-off: greedy assignment — không phải optimal toàn cục, nhưng deterministic
 * và đủ tốt cho dispatch hàng ngày. Để tối ưu thật cần Hungarian algorithm (assignment problem).
 */

const WEIGHTS = {
  workload: 0.4,
  completion: 0.3,
  seniority: 0.15,
  vehicleMatch: 0.15
};

function dateNDaysAgo(n) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d;
}

async function buildDriverStats(orgId) {
  const drivers = await Driver.find({
    OrganizationID: orgId,
    Status: "Active"
  }).lean();

  if (drivers.length === 0) return [];

  // Trips trong 7 ngày qua + lifetime stats
  const since7d = dateNDaysAgo(7);
  const tripAgg = await Trip.aggregate([
    { $match: { DriverID: { $in: drivers.map((d) => d._id) } } },
    {
      $group: {
        _id: "$DriverID",
        totalTrips: { $sum: 1 },
        completed: { $sum: { $cond: [{ $eq: ["$Status", "COMPLETED"] }, 1, 0] } },
        cancelled: { $sum: { $cond: [{ $eq: ["$Status", "CANCELLED"] }, 1, 0] } },
        thisWeek: {
          $sum: { $cond: [{ $gte: ["$createdAt", since7d] }, 1, 0] }
        }
      }
    }
  ]);
  const statsMap = new Map(tripAgg.map((s) => [String(s._id), s]));

  // Tính tuổi tài xế cũ nhất để chuẩn hóa seniority
  const oldestMs = Math.min(...drivers.map((d) => new Date(d.createdAt).getTime()));
  const newestMs = Math.max(...drivers.map((d) => new Date(d.createdAt).getTime()));
  const range = Math.max(1, newestMs - oldestMs);

  return drivers.map((d) => {
    const s = statsMap.get(String(d._id)) ?? { totalTrips: 0, completed: 0, cancelled: 0, thisWeek: 0 };
    const completionRate = s.totalTrips > 0 ? s.completed / s.totalTrips : 0.5; // unknown → neutral
    // seniority: 1.0 với người cũ nhất, 0.0 với người mới nhất
    const seniorityScore = 1 - (new Date(d.createdAt).getTime() - oldestMs) / range;
    return {
      driver: d,
      tripsThisWeek: s.thisWeek,
      totalTrips: s.totalTrips,
      completionRate,
      seniorityScore
    };
  });
}

function scoreDriver(stat, route, vehicleByCode) {
  const workloadScore = 1 / (1 + stat.tripsThisWeek);
  let vehicleMatchBonus = 0;
  if (route.VehicleCode && stat.driver.VehicleType) {
    const vehicle = vehicleByCode.get(route.VehicleCode);
    if (vehicle?.VehicleType === stat.driver.VehicleType) {
      vehicleMatchBonus = 1;
    }
  }
  return (
    WEIGHTS.workload * workloadScore +
    WEIGHTS.completion * stat.completionRate +
    WEIGHTS.seniority * stat.seniorityScore +
    WEIGHTS.vehicleMatch * vehicleMatchBonus
  );
}

/**
 * Tự động gán tài xế cho route trong 1 RoutePlan.
 *
 * @param {string|ObjectId} planId
 * @param {string|ObjectId} orgId
 * @param {object} [opts]
 * @param {boolean} [opts.reassignAll=false] — nếu true, clear DriverID hiện tại rồi phân lại toàn bộ
 * @returns {Promise<{assigned: Array, skipped: Array, summary: object}>}
 */
export async function autoDispatchPlan(planId, orgId, opts = {}) {
  const reassignAll = !!opts.reassignAll;

  const plan = await RoutePlan.findOne({ _id: planId, OrganizationID: orgId }).lean();
  if (!plan) throw new Error("RoutePlan not found");

  const routes = await DeliveryRoute.find({
    RoutePlanID: planId,
    OrganizationID: orgId
  }).sort({ TotalDistance: -1 }); // route nặng nhất đi trước

  if (reassignAll) {
    // Clear driver hiện tại trên tất cả route (chỉ route chưa LOCKED/FINALIZED)
    for (const r of routes) {
      if (r.Status === "LOCKED" || r.Status === "FINALIZED") continue;
      r.DriverID = null;
      r.DriverCode = "";
      r.DriverName = "";
      r.DriverPhone = "";
      await r.save();
    }
  }

  const unassigned = routes.filter((r) => !r.DriverID);
  if (unassigned.length === 0) {
    return {
      assigned: [],
      skipped: [],
      summary: { total: routes.length, unassigned: 0, assigned: 0, alreadyAssigned: routes.length }
    };
  }

  const stats = await buildDriverStats(orgId);
  if (stats.length === 0) {
    return {
      assigned: [],
      skipped: unassigned.map((r) => ({ routeCode: r.RouteCode, reason: "No active driver" })),
      summary: { total: routes.length, unassigned: unassigned.length, assigned: 0 }
    };
  }

  const vehicles = await Vehicle.find({ OrganizationID: orgId }).lean();
  const vehicleByCode = new Map(vehicles.map((v) => [v.VehicleCode, v]));

  // Driver đang được gán trong cùng plan này không thể gán cho route khác
  const usedDriverIds = new Set(
    routes.filter((r) => r.DriverID).map((r) => String(r.DriverID))
  );

  const assigned = [];
  const skipped = [];

  for (const route of unassigned) {
    const candidates = stats
      .filter((s) => !usedDriverIds.has(String(s.driver._id)))
      .map((s) => ({ stat: s, score: scoreDriver(s, route, vehicleByCode) }))
      .sort((a, b) => b.score - a.score);

    if (candidates.length === 0) {
      skipped.push({ routeCode: route.RouteCode, reason: "All drivers already assigned" });
      continue;
    }

    const best = candidates[0];
    route.DriverID = best.stat.driver._id;
    route.DriverCode = best.stat.driver.DriverCode ?? "";
    route.DriverName = best.stat.driver.XName ?? "";
    route.DriverPhone = best.stat.driver.Phone ?? "";
    await route.save();

    usedDriverIds.add(String(best.stat.driver._id));
    // Tăng workload tạm thời để lần lặp sau công bằng hơn
    best.stat.tripsThisWeek += 1;

    assigned.push({
      routeCode: route.RouteCode,
      driverCode: best.stat.driver.DriverCode,
      driverName: best.stat.driver.XName,
      score: Math.round(best.score * 1000) / 1000,
      reasoning: {
        tripsThisWeek: best.stat.tripsThisWeek - 1,
        completionRate: Math.round(best.stat.completionRate * 100) / 100,
        seniority: Math.round(best.stat.seniorityScore * 100) / 100
      }
    });
  }

  return {
    assigned,
    skipped,
    summary: {
      total: routes.length,
      unassigned: unassigned.length,
      assigned: assigned.length,
      skipped: skipped.length
    }
  };
}
