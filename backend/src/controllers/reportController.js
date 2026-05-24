import { SalesOrder, OrderStatus, PlanningStatus, ApprovalStatus } from "../models/SalesOrder.js";
import { Vehicle } from "../models/Vehicle.js";
import { Driver } from "../models/Driver.js";
import { Customer } from "../models/Customer.js";
import { Product } from "../models/Product.js";
import { Trip } from "../models/Trip.js";
import { scopeFilter } from "../middlewares/dac.js";

/**
 * GET /api/reports/summary
 * Tổng hợp thống kê toàn bộ trong phạm vi org (DAC).
 */
export async function summary(req, res) {
  const filter = scopeFilter(req.orgScope, "OrganizationID");

  const { startDate, endDate, periodType = "custom" } = req.query;
  const orderFilter = { ...filter };
  if (startDate && endDate) {
    orderFilter.OrderDate = { $gte: new Date(startDate), $lte: new Date(endDate) };
  }
  const tripFilter = { ...filter };
  if (startDate && endDate) {
    tripFilter.PlanDate = { $gte: new Date(startDate), $lte: new Date(endDate) };
  }

  const [orders, vehicles, drivers, customers, customerDocs, productDocs, trips] = await Promise.all([
    SalesOrder.find(orderFilter)
      .select("OrderCode CustomerCode OrderDate Items TotalPrice TotalServicePrice NumberCollected OrderStatus ApprovalStatus PlanningStatus")
      .sort({ OrderDate: 1, OrderCode: 1 })
      .lean(),
    Vehicle.countDocuments({ ...filter, Status: "Active" }),
    Driver.countDocuments({ ...filter, Status: "Active" }),
    Customer.countDocuments({ ...filter, Status: "Active" }),
    Customer.find(filter).select("CustomerCode XName CustomerGroup Address Phone").lean(),
    Product.find(filter).select("ProductCode XName Category WeightPerCase VolumePerCase ItemsPerCase Price").lean(),
    Trip.find(tripFilter)
      .select("TripCode PlanDate VehicleCode DriverCode DriverName IsOutsourced ServiceCode ServiceName Status PlannedStartTime PlannedReturnTime TotalDistance TotalWeight EstimatedCost TotalCODCollected Tasks")
      .sort({ PlanDate: 1, TripCode: 1 })
      .lean()
  ]);

  const customerByCode = new Map(customerDocs.map((c) => [c.CustomerCode, c]));
  const productByCode = new Map(productDocs.map((p) => [p.ProductCode, p]));
  const round = (value, digits = 2) => Number((value ?? 0).toFixed(digits));
  const dateKey = (value) => new Date(value).toISOString().slice(0, 10);

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

  const orderRows = orders.map((order) => {
    let weight = 0;
    let volume = 0;
    const itemLabels = [];
    const categories = new Set();

    for (const item of order.Items ?? []) {
      const product = productByCode.get(item.ProductCode);
      const cases = item.NumberOfCases ?? 0;
      const pieces = item.NumberOfItems ?? 0;
      const itemsPerCase = product?.ItemsPerCase || 1;
      const equivalentCases = cases + pieces / itemsPerCase;
      weight += equivalentCases * (product?.WeightPerCase ?? 0);
      volume += equivalentCases * (product?.VolumePerCase ?? 0);
      itemLabels.push(`${item.ProductCode}${product?.XName ? ` - ${product.XName}` : ""} (${cases} thùng, ${pieces} lẻ)`);
      if (product?.Category) categories.add(product.Category);
    }

    const customer = customerByCode.get(order.CustomerCode);
    return {
      orderCode: order.OrderCode,
      orderDate: dateKey(order.OrderDate),
      customerCode: order.CustomerCode,
      customerName: customer?.XName ?? "",
      customerGroup: customer?.CustomerGroup ?? "",
      products: itemLabels.join("; "),
      categories: Array.from(categories).join(", "),
      status: order.OrderStatus,
      approvalStatus: order.ApprovalStatus,
      planningStatus: order.PlanningStatus,
      totalWeight: round(weight),
      totalVolume: round(volume, 3),
      totalPrice: order.TotalPrice ?? 0,
      servicePrice: order.TotalServicePrice ?? 0,
      collected: order.NumberCollected ?? 0
    };
  });

  const bookedRevenue = orderRows.reduce((sum, row) => sum + row.totalPrice, 0);
  const goodsAmount = orderRows.reduce((sum, row) => sum + row.totalPrice, 0);
  const serviceAmount = orderRows.reduce((sum, row) => sum + row.servicePrice, 0);
  const totalOrderValue = goodsAmount + serviceAmount;
  const revenue = orderRows
    .filter((row) => row.status === OrderStatus.DELIVERED)
    .reduce((sum, row) => sum + row.totalPrice, 0);
  const estimatedCost = trips.reduce((sum, trip) => sum + (trip.EstimatedCost ?? 0), 0);
  // Tách chi phí Nội bộ (lương tài xế + xe + nhiên liệu) vs 3PL (phí dịch vụ hãng vận chuyển)
  const inHouseTripCost = trips
    .filter((t) => !t.IsOutsourced)
    .reduce((sum, t) => sum + (t.EstimatedCost ?? 0), 0);
  const outsourcedTripCost = trips
    .filter((t) => t.IsOutsourced)
    .reduce((sum, t) => sum + (t.EstimatedCost ?? 0), 0);
  const inHouseTripCount = trips.filter((t) => !t.IsOutsourced).length;
  const outsourcedTripCount = trips.filter((t) => t.IsOutsourced).length;
  const deliveredOrders = orderRows.filter((row) => row.status === OrderStatus.DELIVERED).length;
  const approvedOrders = orderRows.filter((row) => row.approvalStatus === ApprovalStatus.APPROVED).length;
  const plannedOrders = orderRows.filter((row) => [PlanningStatus.PLANNED, PlanningStatus.LOCKED, PlanningStatus.FINALIZED].includes(row.planningStatus)).length;
  const deliveryRate = orders.length ? round((deliveredOrders / orders.length) * 100, 1) : 0;
  const approvalRate = orders.length ? round((approvedOrders / orders.length) * 100, 1) : 0;
  const planningRate = orders.length ? round((plannedOrders / orders.length) * 100, 1) : 0;

  // Daily order count
  const dailyMap = {};
  
  if (startDate && endDate) {
    const start = new Date(startDate);
    const end = new Date(endDate);
    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      dailyMap[d.toISOString().slice(0, 10)] = { date: d.toISOString().slice(0, 10), count: 0, delivered: 0, revenue: 0, cost: 0 };
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
      dailyMap[d.toISOString().slice(0, 10)] = { date: d.toISOString().slice(0, 10), count: 0, delivered: 0, revenue: 0, cost: 0 };
    }
  }

  orders.forEach((o) => {
    const day = dateKey(o.OrderDate);
    if (!dailyMap[day]) dailyMap[day] = { date: day, count: 0, delivered: 0, revenue: 0, cost: 0 };
    dailyMap[day].count++;
    if (o.OrderStatus === OrderStatus.DELIVERED) {
      dailyMap[day].delivered++;
      dailyMap[day].revenue += o.TotalPrice ?? 0;
    }
  });
  trips.forEach((trip) => {
    const day = dateKey(trip.PlanDate);
    if (!dailyMap[day]) dailyMap[day] = { date: day, count: 0, delivered: 0, revenue: 0, cost: 0 };
    dailyMap[day].cost += trip.EstimatedCost ?? 0;
  });
  const dailyOrders = Object.values(dailyMap)
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((row) => ({ ...row, grossProfit: row.revenue - row.cost }));

  const customerMap = new Map();
  orderRows.forEach((row) => {
    const current = customerMap.get(row.customerCode) ?? {
      customerCode: row.customerCode,
      customerName: row.customerName,
      customerGroup: row.customerGroup,
      orders: 0,
      delivered: 0,
      revenue: 0,
      weight: 0,
      volume: 0
    };
    current.orders++;
    if (row.status === OrderStatus.DELIVERED) {
      current.delivered++;
      current.revenue += row.totalPrice;
    }
    current.weight += row.totalWeight;
    current.volume += row.totalVolume;
    customerMap.set(row.customerCode, current);
  });
  const customerRows = Array.from(customerMap.values())
    .map((row) => ({ ...row, weight: round(row.weight), volume: round(row.volume, 3) }))
    .sort((a, b) => b.revenue - a.revenue || b.orders - a.orders);

  const tripRows = trips.map((trip) => {
    const tasks = trip.Tasks ?? [];
    return {
      tripCode: trip.TripCode,
      planDate: dateKey(trip.PlanDate),
      vehicleCode: trip.VehicleCode,
      driverCode: trip.DriverCode,
      driverName: trip.DriverName || trip.ServiceName || "",
      serviceType: trip.IsOutsourced ? "3PL" : "Nội bộ",
      serviceName: trip.ServiceName ?? "",
      status: trip.Status,
      plannedStartTime: trip.PlannedStartTime,
      plannedReturnTime: trip.PlannedReturnTime,
      stops: tasks.length,
      completedStops: tasks.filter((t) => t.Status === "COMPLETED").length,
      failedStops: tasks.filter((t) => t.Status === "FAILED").length,
      distanceKm: round(trip.TotalDistance),
      weightKg: round(trip.TotalWeight),
      estimatedCost: trip.EstimatedCost ?? 0,
      codCollected: trip.TotalCODCollected ?? 0
    };
  });

  const vehicleMap = new Map();
  tripRows.forEach((trip) => {
    const key = trip.vehicleCode || trip.tripCode;
    const current = vehicleMap.get(key) ?? {
      vehicleCode: trip.vehicleCode,
      trips: 0,
      stops: 0,
      completedStops: 0,
      failedStops: 0,
      distanceKm: 0,
      weightKg: 0,
      estimatedCost: 0
    };
    current.trips++;
    current.stops += trip.stops;
    current.completedStops += trip.completedStops;
    current.failedStops += trip.failedStops;
    current.distanceKm += trip.distanceKm;
    current.weightKg += trip.weightKg;
    current.estimatedCost += trip.estimatedCost;
    vehicleMap.set(key, current);
  });
  const vehicleRows = Array.from(vehicleMap.values()).map((row) => ({
    ...row,
    distanceKm: round(row.distanceKm),
    weightKg: round(row.weightKg)
  }));

  res.json({
    success: true,
    data: {
      period: {
        type: periodType,
        startDate: startDate ?? null,
        endDate: endDate ?? null
      },
      totals: {
        orders: orders.length,
        deliveredOrders,
        vehicles,
        drivers,
        customers,
        trips: trips.length,
        inHouseTripCount,
        outsourcedTripCount,
        bookedRevenue,
        goodsAmount,
        serviceAmount,
        totalOrderValue,
        revenue,
        estimatedCost,
        inHouseTripCost,
        outsourcedTripCost,
        grossProfit: revenue - estimatedCost,
        deliveryRate,
        approvalRate,
        planningRate
      },
      byOrderStatus,
      byApproval,
      byPlanning,
      dailyOrders,
      orderRows,
      customerRows,
      tripRows,
      vehicleRows
    }
  });
}
