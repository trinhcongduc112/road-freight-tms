import { SalesOrder, OrderStatus, PlanningStatus, ApprovalStatus } from "../models/SalesOrder.js";
import { Vehicle } from "../models/Vehicle.js";
import { Driver } from "../models/Driver.js";
import { Customer } from "../models/Customer.js";
import { scopeFilter } from "../middlewares/dac.js";

/**
 * GET /api/reports/summary
 * Tổng hợp thống kê toàn bộ trong phạm vi org (DAC).
 */
export async function summary(req, res) {
  const filter = scopeFilter(req.orgScope, "OrganizationID");

  const { startDate, endDate } = req.query;
  const orderFilter = { ...filter };
  if (startDate && endDate) {
    orderFilter.OrderDate = { $gte: new Date(startDate), $lte: new Date(endDate) };
  }

  const [orders, vehicles, drivers, customers] = await Promise.all([
    SalesOrder.find(orderFilter).select("OrderStatus ApprovalStatus PlanningStatus TotalPrice OrderDate").lean(),
    Vehicle.countDocuments({ ...filter, Status: "Active" }),
    Driver.countDocuments({ ...filter, Status: "Active" }),
    Customer.countDocuments({ ...filter, Status: "Active" })
  ]);

  // Order status breakdown
  const byOrderStatus = {};
  Object.values(OrderStatus).forEach((s) => { byOrderStatus[s] = 0; });
  orders.forEach((o) => { byOrderStatus[o.OrderStatus] = (byOrderStatus[o.OrderStatus] ?? 0) + 1; });

  // Approval status breakdown
  const byApproval = {};
  Object.values(ApprovalStatus).forEach((s) => { byApproval[s] = 0; });
  orders.forEach((o) => { byApproval[o.ApprovalStatus] = (byApproval[o.ApprovalStatus] ?? 0) + 1; });

  // Planning status breakdown
  const byPlanning = {};
  Object.values(PlanningStatus).forEach((s) => { byPlanning[s] = 0; });
  orders.forEach((o) => { byPlanning[o.PlanningStatus] = (byPlanning[o.PlanningStatus] ?? 0) + 1; });

  // Revenue: sum TotalPrice of DELIVERED orders
  const revenue = orders
    .filter((o) => o.OrderStatus === OrderStatus.DELIVERED)
    .reduce((sum, o) => sum + (o.TotalPrice ?? 0), 0);

  // Daily order count
  const dailyMap = {};
  
  if (startDate && endDate) {
    const start = new Date(startDate);
    const end = new Date(endDate);
    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      dailyMap[d.toISOString().slice(0, 10)] = 0;
    }
  } else {
    // Default to last 30 days if no range is provided
    const now = new Date();
    const thirtyDaysAgo = new Date(now);
    thirtyDaysAgo.setDate(now.getDate() - 29);
    thirtyDaysAgo.setHours(0, 0, 0, 0);
    for (let i = 0; i < 30; i++) {
      const d = new Date(thirtyDaysAgo);
      d.setDate(thirtyDaysAgo.getDate() + i);
      dailyMap[d.toISOString().slice(0, 10)] = 0;
    }
  }

  orders.forEach((o) => {
    const day = new Date(o.OrderDate).toISOString().slice(0, 10);
    if (dailyMap[day] !== undefined) dailyMap[day]++;
  });
  const dailyOrders = Object.entries(dailyMap).map(([date, count]) => ({ date, count }));

  res.json({
    success: true,
    data: {
      totals: {
        orders: orders.length,
        vehicles,
        drivers,
        customers,
        revenue
      },
      byOrderStatus,
      byApproval,
      byPlanning,
      dailyOrders
    }
  });
}
