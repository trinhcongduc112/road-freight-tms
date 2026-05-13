import mongoose from "mongoose";
import { RoutePlan, RoutePlanStatus } from "../models/RoutePlan.js";
import { DeliveryRoute, RouteStatus } from "../models/DeliveryRoute.js";
import { SalesOrder, OrderStatus, PlanningStatus, ApprovalStatus } from "../models/SalesOrder.js";
import { Vehicle } from "../models/Vehicle.js";
import { Driver } from "../models/Driver.js";
import { Service } from "../models/Service.js";
import { Customer } from "../models/Customer.js";
import { Product } from "../models/Product.js";
import { ProductCategory } from "../models/ProductCategory.js";
import { Organization } from "../models/Organization.js";
import { ApiError } from "../utils/apiError.js";
import { assertOrgInScope, scopeFilter } from "../middlewares/dac.js";
import { hasPermission, Modules, RoutePlanActions, p } from "../config/permissions.js";
import { optimizeRoutes } from "../utils/routeOptimizer.js";
import { callOptimizer, callBenchmark } from "../utils/optimizerClient.js";

function checkRoutePlanPermission(req, action) {
  if (req.user?.IsSuperAdmin) return;
  const granted = req.role?.Permissions ?? [];
  if (!hasPermission(granted, p(Modules.ROUTE_PLAN, action))) {
    throw new ApiError(403, `Missing permission: ${p(Modules.ROUTE_PLAN, action)}`);
  }
}

/* ── Helpers ── */

async function bulkUpdateOrderPlanningStatus(orderIDs, fromStatus, toStatus, userId) {
  for (const id of orderIDs) {
    const order = await SalesOrder.findById(id);
    if (!order || order.PlanningStatus !== fromStatus) continue;
    order.PlanningStatus = toStatus;
    order.PlanningHistory.push({ FromStatus: fromStatus, ToStatus: toStatus, ChangedBy: userId });
    await order.save();
  }
}

function collectOrderIDs(route) {
  return route.Stops.flatMap((s) => s.OrderIDs.map(String));
}

function orderDateEligibleUntil(planDate) {
  const end = new Date(planDate);
  end.setUTCHours(0, 0, 0, 0);
  end.setUTCDate(end.getUTCDate() + 1);
  return { $lt: end };
}

function parsePlanDate(planDate) {
  if (typeof planDate === "string") {
    const dateOnly = planDate.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (dateOnly) {
      return new Date(Date.UTC(Number(dateOnly[1]), Number(dateOnly[2]) - 1, Number(dateOnly[3])));
    }
  }
  const date = new Date(planDate);
  date.setUTCHours(0, 0, 0, 0);
  return date;
}

/** Resolve the warehouse (DEPOT) that should anchor a plan's routing.
 *  Walks descendants of the plan's organization looking for an OrgType=DEPOT
 *  with valid coords. Falls back to the org itself if no depot child exists. */
async function resolveDepotForOrg(orgId) {
  const root = await Organization.findById(orgId).lean();
  if (!root) return null;
  const isDepot = (o) => o.OrgType === "DEPOT" && o.Latitude != null && o.Longitude != null;
  if (isDepot(root)) return root;
  let frontier = [root._id];
  const seen = new Set([String(root._id)]);
  while (frontier.length) {
    const children = await Organization.find({ Parent: { $in: frontier } }).lean();
    if (!children.length) break;
    const next = [];
    for (const c of children) {
      if (isDepot(c)) return c;
      const key = String(c._id);
      if (!seen.has(key)) {
        seen.add(key);
        next.push(c._id);
      }
    }
    frontier = next;
  }
  return null;
}

async function collectOrgSubtreeIds(orgId) {
  const ids = [new mongoose.Types.ObjectId(orgId)];
  let frontier = ids;
  const seen = new Set(ids.map(String));
  while (frontier.length) {
    const children = await Organization.find({ Parent: { $in: frontier } }, { _id: 1 }).lean();
    const next = [];
    for (const child of children) {
      const key = String(child._id);
      if (seen.has(key)) continue;
      seen.add(key);
      ids.push(child._id);
      next.push(child._id);
    }
    frontier = next;
  }
  return ids;
}

async function findAvailableDriver(orgIds, usedDriverIds = new Set()) {
  const drivers = await Driver.find({ OrganizationID: { $in: orgIds }, Status: "Active" }).sort({ DriverCode: 1 }).lean();
  return drivers.find((d) => !usedDriverIds.has(String(d._id))) ?? null;
}

function haversineKm(lat1, lng1, lat2, lng2) {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2
          + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

function minutesToHHMM(minutes) {
  const h = Math.floor(minutes / 60) % 24;
  const m = Math.round(minutes) % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

const SHIFT_DEPART_MINUTES = { MORNING: 8 * 60, AFTERNOON: 13 * 60 + 30, FULL_DAY: 8 * 60 };
const SHIFT_END_MINUTES = { MORNING: 12 * 60, AFTERNOON: 17 * 60 + 30, FULL_DAY: 17 * 60 + 30 };
const LUNCH_START_MINUTES = 12 * 60;
const LUNCH_END_MINUTES = 13 * 60 + 30;
const ROAD_TIME_FACTOR = 1.35;
const DEFAULT_URBAN_SPEED_KMH = 28;
const DEFAULT_LOADING_MINUTES = 30;
const MAX_LOADING_MINUTES = 30;
const LIGHT_UNLOADING_MINUTES = 15;
const HEAVY_UNLOADING_MINUTES = 30;
const HEAVY_STOP_CASE_THRESHOLD = 10;

function addWorkMinutes(startMinutes, durationMinutes, shift) {
  if (shift !== "FULL_DAY") return startMinutes + durationMinutes;
  if (startMinutes >= LUNCH_START_MINUTES && startMinutes < LUNCH_END_MINUTES) {
    return LUNCH_END_MINUTES + durationMinutes;
  }
  const endMinutes = startMinutes + durationMinutes;
  if (startMinutes < LUNCH_START_MINUTES && endMinutes >= LUNCH_START_MINUTES) {
    return endMinutes + (LUNCH_END_MINUTES - LUNCH_START_MINUTES);
  }
  return endMinutes;
}

function stopServiceMinutes(vehicle, stop) {
  const caseCount = stop?.CaseCount ?? stop?.caseCount ?? 0;
  const orderCount = stop?.OrderIDs?.length ?? stop?.orders?.length ?? 1;
  return caseCount >= HEAVY_STOP_CASE_THRESHOLD || orderCount > 1
    ? HEAVY_UNLOADING_MINUTES
    : LIGHT_UNLOADING_MINUTES;
}

function loadingMinutes(vehicle) {
  return Math.min(vehicle?.LoadingTime ?? vehicle?.loadingTime ?? DEFAULT_LOADING_MINUTES, MAX_LOADING_MINUTES);
}

/** Walk route stops in order, recompute PlannedArrivalTime + TotalDistance.
 *  Uses vehicle.AvgSpeedKmh, vehicle.LoadingTime (at depot), vehicle.UnloadingTimePerStop.
 *  departMinutes defaults to MORNING shift (08:00) when not provided.
 */
function recomputeRouteTimings(route, vehicle, depotLatLng, departMinutes) {
  if (departMinutes == null) {
    departMinutes = SHIFT_DEPART_MINUTES[route?.Shift] ?? SHIFT_DEPART_MINUTES.MORNING;
  }
  const speed = vehicle?.AvgSpeedKmh > 0 ? vehicle.AvgSpeedKmh : DEFAULT_URBAN_SPEED_KMH;
  const loadTime = loadingMinutes(vehicle);
  if (!route.Stops?.length || !depotLatLng) {
    route.TotalDistance = 0;
    route.PlannedStartTime = "";
    route.PlannedReturnTime = "";
    return;
  }
  route.PlannedStartTime = minutesToHHMM(departMinutes);
  let t = addWorkMinutes(departMinutes, loadTime, route?.Shift);
  let prev = depotLatLng;
  let dist = 0;
  for (const stop of route.Stops) {
    const next = (stop.Latitude != null && stop.Longitude != null)
      ? [stop.Latitude, stop.Longitude]
      : prev;
    const leg = haversineKm(prev[0], prev[1], next[0], next[1]);
    dist += leg;
    t = addWorkMinutes(t, (leg * ROAD_TIME_FACTOR / speed) * 60, route?.Shift);
    stop.PlannedArrivalTime = minutesToHHMM(t);
    stop.PlannedServiceTime = stopServiceMinutes(vehicle, stop);
    t = addWorkMinutes(t, stop.PlannedServiceTime, route?.Shift);
    stop.PlannedDepartureTime = minutesToHHMM(t);
    prev = next;
  }
  /* return to depot */
  const back = haversineKm(prev[0], prev[1], depotLatLng[0], depotLatLng[1]);
  dist += back;
  t = addWorkMinutes(t, (back * ROAD_TIME_FACTOR / speed) * 60, route?.Shift);
  route.PlannedReturnTime = minutesToHHMM(t);
  route.TotalDistance = Math.round(dist * 10) / 10;
}

async function recomputeEstimatedCost(route) {
  if (route.IsOutsourced && route.ServiceID) {
    const svc = await Service.findById(route.ServiceID).lean();
    const km  = route.TotalDistance ?? 0;
    const kg  = route.TotalWeight ?? 0;
    const cbm = route.TotalVolume ?? 0;
    const base = (svc?.FlatRate ?? 0) + (svc?.PricePerKm ?? 0) * km
               + (svc?.PricePerKg ?? 0) * kg + (svc?.PricePerCBM ?? 0) * cbm;
    const charged = Math.max(base, svc?.MinCharge ?? 0);
    route.EstimatedCost = Math.round(charged * (1 + (svc?.FuelSurchargePercent ?? 0) / 100));
    return;
  }
  const veh = await Vehicle.findById(route.VehicleID).lean();
  route.EstimatedCost = Math.round((veh?.FixedCost ?? 0) + (veh?.CostPerKm ?? 0) * (route.TotalDistance ?? 0));
}

async function enrichRoutesForPlanner(routes, planOrgId) {
  const orgSubtreeIds = await collectOrgSubtreeIds(planOrgId);
  const orderIds = routes.flatMap((route) =>
    (route.Stops ?? []).flatMap((stop) => (stop.OrderIDs ?? []).map(String))
  );
  const customerCodes = [...new Set(routes.flatMap((route) =>
    (route.Stops ?? []).map((stop) => stop.CustomerCode).filter(Boolean)
  ))];

  const [orders, customers] = await Promise.all([
    orderIds.length ? SalesOrder.find({ _id: { $in: orderIds } }).lean() : [],
    customerCodes.length ? Customer.find({ OrganizationID: { $in: orgSubtreeIds }, CustomerCode: { $in: customerCodes } }).lean() : []
  ]);

  const productCodes = [...new Set(orders.flatMap((order) =>
    (order.Items ?? []).map((item) => item.ProductCode).filter(Boolean)
  ))];
  const products = productCodes.length
    ? await Product.find({ OrganizationID: { $in: orgSubtreeIds }, ProductCode: { $in: productCodes } }).lean()
    : [];

  const orderById = Object.fromEntries(orders.map((order) => [String(order._id), order]));
  const customerByCode = Object.fromEntries(customers.map((customer) => [customer.CustomerCode, customer]));
  const productByCode = Object.fromEntries(products.map((product) => [product.ProductCode, product]));

  return routes.map((route) => ({
    ...route,
    Stops: (route.Stops ?? []).map((stop) => {
      const customer = customerByCode[stop.CustomerCode];
      const stopOrders = (stop.OrderIDs ?? []).map((orderId, idx) => {
        const order = orderById[String(orderId)];
        return {
          _id: String(orderId),
          OrderCode: order?.OrderCode ?? stop.OrderCodes?.[idx] ?? "",
          CustomerCode: order?.CustomerCode ?? stop.CustomerCode,
          TotalPrice: order?.TotalPrice ?? 0,
          Items: (order?.Items ?? []).map((item) => ({
            ...item,
            ProductName: productByCode[item.ProductCode]?.XName ?? item.ProductCode
          }))
        };
      });
      return {
        ...stop,
        CustomerName: customer?.XName ?? "",
        CustomerGroup: customer?.CustomerGroup ?? "",
        Phone: customer?.Phone ?? "",
        Orders: stopOrders
      };
    })
  }));
}

async function refreshRouteMetrics(route, planOrgId) {
  route.Stops = (route.Stops ?? []).filter((stop) => (stop.OrderIDs ?? []).length > 0);
  route.Stops.forEach((stop, idx) => { stop.StopIndex = idx + 1; });

  const orderIds = route.Stops.flatMap((stop) => (stop.OrderIDs ?? []).map(String));
  if (!orderIds.length) {
    route.TotalWeight = 0;
    route.TotalVolume = 0;
    route.TotalDistance = 0;
    route.EstimatedCost = 0;
    return;
  }

  const orgSubtreeIds = await collectOrgSubtreeIds(planOrgId);
  const orders = await SalesOrder.find({ _id: { $in: orderIds } }).lean();
  const prodCodes = [...new Set(orders.flatMap((order) => (order.Items ?? []).map((item) => item.ProductCode)))];
  const products = prodCodes.length
    ? await Product.find({ OrganizationID: { $in: orgSubtreeIds }, ProductCode: { $in: prodCodes } }).lean()
    : [];
  const productByCode = Object.fromEntries(products.map((product) => [product.ProductCode, product]));

  let totalWeight = 0;
  let totalVolume = 0;
  const caseCountByCustomer = new Map();
  for (const order of orders) {
    let orderCases = 0;
    for (const item of order.Items ?? []) {
      const product = productByCode[item.ProductCode];
      const cases = item.NumberOfCases ?? 0;
      orderCases += cases;
      totalWeight += cases * (product?.WeightPerCase ?? 10);
      totalVolume += cases * (product?.VolumePerCase ?? 0.02);
    }
    const current = caseCountByCustomer.get(order.CustomerCode) ?? 0;
    caseCountByCustomer.set(order.CustomerCode, current + orderCases);
  }
  route.TotalWeight = Math.round(totalWeight * 100) / 100;
  route.TotalVolume = Math.round(totalVolume * 1000) / 1000;

  const customerCodes = [...new Set(route.Stops.map((stop) => stop.CustomerCode).filter(Boolean))];
  const customers = customerCodes.length
    ? await Customer.find({ OrganizationID: { $in: orgSubtreeIds }, CustomerCode: { $in: customerCodes } }).lean()
    : [];
  const customerByCode = Object.fromEntries(customers.map((customer) => [customer.CustomerCode, customer]));
  for (const stop of route.Stops) {
    const customer = customerByCode[stop.CustomerCode];
    if (customer) {
      stop.Address = stop.Address || customer.Address || "";
      stop.Latitude = customer.Latitude ?? stop.Latitude ?? null;
      stop.Longitude = customer.Longitude ?? stop.Longitude ?? null;
    }
    stop.CaseCount = caseCountByCustomer.get(stop.CustomerCode) ?? stop.CaseCount ?? 0;
    stop.PlannedServiceTime = stopServiceMinutes(null, stop);
  }

  const depotOrg = await resolveDepotForOrg(planOrgId);
  const depot = depotOrg ? [depotOrg.Latitude, depotOrg.Longitude] : null;
  const vehicle = await Vehicle.findById(route.VehicleID).lean();
  recomputeRouteTimings(route, vehicle, depot);
  await recomputeEstimatedCost(route);
}

function routeDistanceFromStops(depot, routeStops) {
  if (!routeStops.length) return 0;
  let dist = 0;
  let prev = depot;
  for (const stop of routeStops) {
    dist += haversineKm(prev.lat, prev.lng, stop.lat, stop.lng);
    prev = stop;
  }
  dist += haversineKm(prev.lat, prev.lng, depot.lat, depot.lng);
  return dist;
}

function estimateFullDayFinishMinutes(depot, routeStops, vehicle) {
  if (!routeStops.length) return SHIFT_DEPART_MINUTES.FULL_DAY;
  let t = SHIFT_DEPART_MINUTES.FULL_DAY + loadingMinutes(vehicle);
  let prev = depot;
  const speed = vehicle.avgSpeedKmh > 0 ? vehicle.avgSpeedKmh : DEFAULT_URBAN_SPEED_KMH;
  for (const stop of routeStops) {
    const leg = haversineKm(prev.lat, prev.lng, stop.lat, stop.lng);
    t = addWorkMinutes(t, (leg * ROAD_TIME_FACTOR / speed) * 60, "FULL_DAY");
    t = addWorkMinutes(t, stopServiceMinutes(vehicle, stop), "FULL_DAY");
    prev = stop;
  }
  const back = haversineKm(prev.lat, prev.lng, depot.lat, depot.lng);
  return addWorkMinutes(t, (back * ROAD_TIME_FACTOR / speed) * 60, "FULL_DAY");
}

function estimateShiftFinishMinutes(depot, routeStops, vehicle, shift) {
  if (shift === "FULL_DAY") return estimateFullDayFinishMinutes(depot, routeStops, vehicle);
  if (!routeStops.length) return SHIFT_DEPART_MINUTES[shift] ?? SHIFT_DEPART_MINUTES.MORNING;
  let t = (SHIFT_DEPART_MINUTES[shift] ?? SHIFT_DEPART_MINUTES.MORNING) + loadingMinutes(vehicle);
  let prev = depot;
  const speed = vehicle.avgSpeedKmh > 0 ? vehicle.avgSpeedKmh : DEFAULT_URBAN_SPEED_KMH;
  for (const stop of routeStops) {
    const leg = haversineKm(prev.lat, prev.lng, stop.lat, stop.lng);
    t += (leg * ROAD_TIME_FACTOR / speed) * 60;
    t += stopServiceMinutes(vehicle, stop);
    prev = stop;
  }
  const back = haversineKm(prev.lat, prev.lng, depot.lat, depot.lng);
  return t + (back * ROAD_TIME_FACTOR / speed) * 60;
}

function fullDayVehicleCanTakeStop(vehicle, load, stop, meta) {
  if (vehicle.maxWeight > 0 && load.weight + stop.weight > vehicle.maxWeight) return false;
  if (vehicle.maxVolume > 0 && load.volume + stop.volume > vehicle.maxVolume) return false;
  const caps = vehicle.capabilities ?? [];
  for (const need of (stop.requiredCapabilities ?? [])) if (!caps.includes(need)) return false;
  for (const cls of (stop.handlingClasses ?? [])) if (meta.incompat.has(cls)) return false;
  for (const cls of (stop.incompatibleClasses ?? [])) if (meta.classes.has(cls)) return false;
  return true;
}

function recordFullDayStop(load, stop, meta) {
  load.weight += stop.weight;
  load.volume += stop.volume;
  (stop.handlingClasses ?? []).forEach((cls) => meta.classes.add(cls));
  (stop.incompatibleClasses ?? []).forEach((cls) => meta.incompat.add(cls));
}

function buildFullDayPackedRoutes({ depot, vehicles, stops }) {
  const remaining = [...stops];
  const routes = [];
  const sortedVehicles = [...vehicles].sort((a, b) => (b.maxWeight ?? 0) - (a.maxWeight ?? 0));

  for (const vehicle of sortedVehicles) {
    const routeStops = [];
    const load = { weight: 0, volume: 0 };
    const meta = { classes: new Set(), incompat: new Set() };

    while (remaining.length) {
      let bestIdx = -1;
      let bestPos = -1;
      let bestDelta = Infinity;

      for (let i = 0; i < remaining.length; i++) {
        const stop = remaining[i];
        if (!fullDayVehicleCanTakeStop(vehicle, load, stop, meta)) continue;

        for (let pos = 0; pos <= routeStops.length; pos++) {
          const candidate = [...routeStops.slice(0, pos), stop, ...routeStops.slice(pos)];
          if (estimateFullDayFinishMinutes(depot, candidate, vehicle) > SHIFT_END_MINUTES.FULL_DAY) continue;
          const delta = routeDistanceFromStops(depot, candidate) - routeDistanceFromStops(depot, routeStops);
          if (delta < bestDelta) {
            bestIdx = i;
            bestPos = pos;
            bestDelta = delta;
          }
        }
      }

      if (bestIdx === -1) break;
      const [stop] = remaining.splice(bestIdx, 1);
      routeStops.splice(bestPos, 0, stop);
      recordFullDayStop(load, stop, meta);
    }

    if (routeStops.length) {
      routes.push({
        vehicleID: vehicle.id,
        vehicleCode: vehicle.code,
        stops: routeStops.map((stop, idx) => ({
          ...stop,
          stopIndex: idx + 1,
          plannedArrival: ""
        })),
        totalDistance: Math.round(routeDistanceFromStops(depot, routeStops) * 10) / 10,
        totalWeight: Math.round(load.weight * 100) / 100,
        totalVolume: Math.round(load.volume * 1000) / 1000
      });
    }
  }

  return { routes, unassigned: remaining };
}

function buildShiftConstrainedRoutes({ depot, vehicles, stops, shift }) {
  const remaining = [...stops];
  const routes = [];
  const shiftEnd = SHIFT_END_MINUTES[shift] ?? SHIFT_END_MINUTES.MORNING;
  const sortedVehicles = [...vehicles].sort((a, b) => (b.maxWeight ?? 0) - (a.maxWeight ?? 0));

  for (const vehicle of sortedVehicles) {
    const routeStops = [];
    const load = { weight: 0, volume: 0 };
    const meta = { classes: new Set(), incompat: new Set() };

    while (remaining.length) {
      let bestIdx = -1;
      let bestPos = -1;
      let bestDelta = Infinity;

      for (let i = 0; i < remaining.length; i++) {
        const stop = remaining[i];
        if (!fullDayVehicleCanTakeStop(vehicle, load, stop, meta)) continue;

        for (let pos = 0; pos <= routeStops.length; pos++) {
          const candidate = [...routeStops.slice(0, pos), stop, ...routeStops.slice(pos)];
          if (estimateShiftFinishMinutes(depot, candidate, vehicle, shift) > shiftEnd) continue;
          const delta = routeDistanceFromStops(depot, candidate) - routeDistanceFromStops(depot, routeStops);
          if (delta < bestDelta) {
            bestIdx = i;
            bestPos = pos;
            bestDelta = delta;
          }
        }
      }

      if (bestIdx === -1) break;
      const [stop] = remaining.splice(bestIdx, 1);
      routeStops.splice(bestPos, 0, stop);
      recordFullDayStop(load, stop, meta);
    }

    if (routeStops.length) {
      routes.push({
        vehicleID: vehicle.id,
        vehicleCode: vehicle.code,
        stops: routeStops.map((stop, idx) => ({
          ...stop,
          stopIndex: idx + 1,
          plannedArrival: ""
        })),
        totalDistance: Math.round(routeDistanceFromStops(depot, routeStops) * 10) / 10,
        totalWeight: Math.round(load.weight * 100) / 100,
        totalVolume: Math.round(load.volume * 1000) / 1000
      });
    }
  }

  return { routes, unassigned: remaining };
}

/* ══════════════════
   ROUTE PLAN CRUD
══════════════════ */

/** GET /api/route-plans */
export async function listRoutePlans(req, res) {
  const filter = scopeFilter(req.orgScope, "OrganizationID");
  if (req.query.organizationId) {
    assertOrgInScope(req.orgScope, req.query.organizationId);
    filter.OrganizationID = req.query.organizationId;
  }
  if (req.query.status) filter.Status = req.query.status;
  if (req.query.from) filter.PlanDate = { ...filter.PlanDate, $gte: new Date(req.query.from) };
  if (req.query.to) filter.PlanDate = { ...filter.PlanDate, $lte: new Date(req.query.to) };
  const plans = await RoutePlan.find(filter).sort({ PlanDate: -1 }).lean();
  res.json({ success: true, data: plans });
}

/** GET /api/route-plans/:id */
export async function getRoutePlan(req, res) {
  const plan = await RoutePlan.findById(req.params.id).lean();
  if (!plan) throw new ApiError(404, "Route Plan not found");
  assertOrgInScope(req.orgScope, plan.OrganizationID);

  const routes = await DeliveryRoute.find({ RoutePlanID: plan._id })
    .populate("VehicleID", "VehicleCode XName MaxWeight MaxVolume")
    .populate("DriverID", "DriverCode XName Phone")
    .lean();

  res.json({ success: true, data: { ...plan, routes: await enrichRoutesForPlanner(routes, plan.OrganizationID) } });
}

/** POST /api/route-plans */
export async function createRoutePlan(req, res) {
  checkRoutePlanPermission(req, "update");
  const { OrganizationID, PlanDate, Notes, PlanName, Shift } = req.body ?? {};
  if (!OrganizationID || !PlanDate) throw new ApiError(400, "OrganizationID and PlanDate are required");
  if (!mongoose.isValidObjectId(OrganizationID)) throw new ApiError(400, "Invalid OrganizationID");
  assertOrgInScope(req.orgScope, OrganizationID);

  const planOrg = await Organization.findById(OrganizationID).lean();
  if (!planOrg) throw new ApiError(404, "Organization not found");
  if (planOrg.OrgType !== "DEPOT" || planOrg.Latitude == null || planOrg.Longitude == null) {
    throw new ApiError(400, "Chỉ được lập kế hoạch từ kho (DEPOT) có tọa độ hợp lệ");
  }

  const date = parsePlanDate(PlanDate);

  const dateStr = date.toISOString().slice(0, 10).replace(/-/g, "");

  /* Compute next sequence by counting plans for this org+date (not all-time, so codes
     stay short and predictable). */
  const dayStart = new Date(date);
  const dayEnd = new Date(date); dayEnd.setUTCDate(dayEnd.getUTCDate() + 1);
  const sameDayCount = await RoutePlan.countDocuments({ OrganizationID, PlanDate: { $gte: dayStart, $lt: dayEnd } });

  async function tryCreate(seq) {
    const PlanCode = `RP-${dateStr}-${String(seq).padStart(3, "0")}`;
    return RoutePlan.create({
      PlanCode, OrganizationID, PlanDate: date,
      Notes: Notes ?? "", PlanName: PlanName ?? "",
      Shift: ["MORNING", "AFTERNOON", "FULL_DAY"].includes(Shift) ? Shift : "FULL_DAY",
      CreatedBy: req.user._id
    });
  }

  let plan;
  try {
    plan = await tryCreate(sameDayCount + 1);
  } catch (err) {
    /* MongoDB duplicate key — likely a legacy unique compound index on
       (OrganizationID, PlanDate) from an earlier schema version. Drop it once
       and retry. */
    if (err?.code === 11000) {
      try {
        await RoutePlan.collection.dropIndex("OrganizationID_1_PlanDate_1");
        // eslint-disable-next-line no-console
        console.log("[RoutePlan] Dropped legacy unique index OrganizationID_1_PlanDate_1");
      } catch { /* index already gone */ }
      /* Also retry with bumped sequence in case the dup was on PlanCode */
      plan = await tryCreate(sameDayCount + 2);
    } else {
      throw err;
    }
  }
  res.status(201).json({ success: true, data: plan });
}

/** DELETE /api/route-plans/:id */
export async function deleteRoutePlan(req, res) {
  checkRoutePlanPermission(req, "update");
  const plan = await RoutePlan.findById(req.params.id);
  if (!plan) throw new ApiError(404, "Route Plan not found");
  assertOrgInScope(req.orgScope, plan.OrganizationID);

  const routes = await DeliveryRoute.find({ RoutePlanID: plan._id });
  if (plan.Status === RoutePlanStatus.FINALIZED || routes.some((route) => route.Status === RouteStatus.FINALIZED)) {
    throw new ApiError(409, "Không được xóa kế hoạch đã finalized");
  }
  for (const route of routes) {
    const ids = collectOrderIDs(route);
    const fromStatus = route.Status === RouteStatus.LOCKED ? PlanningStatus.LOCKED : PlanningStatus.PLANNED;
    await bulkUpdateOrderPlanningStatus(ids, fromStatus, PlanningStatus.PENDING, req.user._id);
  }
  await DeliveryRoute.deleteMany({ RoutePlanID: plan._id });
  await plan.deleteOne();
  res.json({ success: true });
}

/** PATCH /api/route-plans/:id */
export async function updateRoutePlan(req, res) {
  checkRoutePlanPermission(req, "update");
  const plan = await RoutePlan.findById(req.params.id);
  if (!plan) throw new ApiError(404, "Route Plan not found");
  assertOrgInScope(req.orgScope, plan.OrganizationID);
  if (plan.Status !== RoutePlanStatus.DRAFT) throw new ApiError(409, "Chỉ được sửa kế hoạch DRAFT");

  const { Shift, Notes, PlanName } = req.body ?? {};
  if (Shift !== undefined) {
    if (!["MORNING", "AFTERNOON", "FULL_DAY"].includes(Shift)) throw new ApiError(400, "Shift không hợp lệ");
    plan.Shift = Shift;
  }
  if (Notes !== undefined) plan.Notes = Notes ?? "";
  if (PlanName !== undefined) plan.PlanName = PlanName ?? "";

  await plan.save();
  res.json({ success: true, data: plan });
}

/* ══════════════════════
   DELIVERY ROUTE ops
══════════════════════ */

/** GET /api/route-plans/:id/routes */
export async function listRoutes(req, res) {
  const plan = await RoutePlan.findById(req.params.id).lean();
  if (!plan) throw new ApiError(404, "Route Plan not found");
  assertOrgInScope(req.orgScope, plan.OrganizationID);

  const routes = await DeliveryRoute.find({ RoutePlanID: plan._id })
    .populate("VehicleID", "VehicleCode XName MaxWeight MaxVolume")
    .populate("DriverID", "DriverCode XName Phone")
    .lean();
  res.json({ success: true, data: await enrichRoutesForPlanner(routes, plan.OrganizationID) });
}

/** POST /api/route-plans/:id/routes — add a vehicle to plan */
export async function addRoute(req, res) {
  checkRoutePlanPermission(req, "update");
  const plan = await RoutePlan.findById(req.params.id);
  if (!plan) throw new ApiError(404, "Route Plan not found");
  assertOrgInScope(req.orgScope, plan.OrganizationID);
  if (plan.Status === RoutePlanStatus.FINALIZED) throw new ApiError(409, "Plan is finalized");

  const { VehicleID, DriverID, Notes } = req.body ?? {};
  if (!VehicleID || !mongoose.isValidObjectId(VehicleID)) throw new ApiError(400, "Valid VehicleID required");

  const vehicle = await Vehicle.findById(VehicleID).lean();
  if (!vehicle) throw new ApiError(404, "Vehicle not found");
  assertOrgInScope(req.orgScope, vehicle.OrganizationID);
  if (String(vehicle.OrganizationID) !== String(plan.OrganizationID)) {
    throw new ApiError(400, "Xe không thuộc kho lập kế hoạch này");
  }

  const dup = await DeliveryRoute.findOne({ RoutePlanID: plan._id, VehicleID });
  if (dup) throw new ApiError(409, "Vehicle already assigned to this plan");
  const orgSubtreeIds = await collectOrgSubtreeIds(plan.OrganizationID);
  const usedDriverIds = new Set((await DeliveryRoute.find({ RoutePlanID: plan._id, DriverID: { $ne: null } }, { DriverID: 1 }).lean()).map((r) => String(r.DriverID)));
  const autoDriver = DriverID ? await Driver.findById(DriverID).lean() : await findAvailableDriver(orgSubtreeIds, usedDriverIds);

  const route = await DeliveryRoute.create({
    RoutePlanID: plan._id,
    OrganizationID: plan.OrganizationID,
    VehicleID,
    VehicleCode: vehicle.VehicleCode,
    DriverID: autoDriver?._id ?? null,
    DriverCode: autoDriver?.DriverCode ?? "",
    Stops: [],
    Notes: Notes ?? ""
  });
  res.status(201).json({ success: true, data: route });
}

/** DELETE /api/route-plans/:planId/routes/:routeId */
export async function removeRoute(req, res) {
  checkRoutePlanPermission(req, "update");
  const plan = await RoutePlan.findById(req.params.planId);
  if (!plan) throw new ApiError(404, "Route Plan not found");
  assertOrgInScope(req.orgScope, plan.OrganizationID);
  if (plan.Status === RoutePlanStatus.FINALIZED) throw new ApiError(409, "Plan is finalized");

  const route = await DeliveryRoute.findOne({ _id: req.params.routeId, RoutePlanID: plan._id });
  if (!route) throw new ApiError(404, "Route not found");
  if (route.Status === RouteStatus.FINALIZED) throw new ApiError(409, "Cannot remove a finalized route");

  const ids = collectOrderIDs(route);
  const fromStatus = route.Status === RouteStatus.LOCKED ? PlanningStatus.LOCKED : PlanningStatus.PLANNED;
  await bulkUpdateOrderPlanningStatus(ids, fromStatus, PlanningStatus.PENDING, req.user._id);
  await route.deleteOne();
  const remainingRoutes = await DeliveryRoute.find({ RoutePlanID: plan._id }).lean();
  if (!remainingRoutes.some((r) => r.Status === RouteStatus.LOCKED || r.Status === RouteStatus.FINALIZED)) {
    plan.Status = RoutePlanStatus.DRAFT;
    await plan.save();
  }
  res.json({ success: true });
}

/* ── Stop / Order assignment ── */

/**
 * POST /api/route-plans/:planId/routes/:routeId/stops
 * Body: { OrderID, CustomerCode, Address? }
 * Adds an order to the appropriate stop (or creates new stop for customer).
 */
export async function addOrderToRoute(req, res) {
  checkRoutePlanPermission(req, "update");
  const plan = await RoutePlan.findById(req.params.planId);
  if (!plan) throw new ApiError(404, "Route Plan not found");
  assertOrgInScope(req.orgScope, plan.OrganizationID);

  const route = await DeliveryRoute.findOne({ _id: req.params.routeId, RoutePlanID: plan._id });
  if (!route) throw new ApiError(404, "Route not found");
  if (route.Status !== RouteStatus.PLANNED) throw new ApiError(409, "Route is locked/finalized");

  const { OrderID, CustomerCode, Address } = req.body ?? {};
  if (!OrderID || !CustomerCode) throw new ApiError(400, "OrderID and CustomerCode required");

  const order = await SalesOrder.findById(OrderID);
  if (!order) throw new ApiError(404, "Order not found");
  assertOrgInScope(req.orgScope, order.OrganizationID);

  if (order.ApprovalStatus !== ApprovalStatus.APPROVED) {
    throw new ApiError(409, "Chỉ được lên kế hoạch cho đơn đã được phê duyệt (ApprovalStatus=APPROVED)");
  }

  const orderIdStr = order._id.toString();
  const alreadyIn = route.Stops.some((s) => s.OrderIDs.map(String).includes(orderIdStr));
  if (alreadyIn) throw new ApiError(409, "Order already assigned to this route");

  const cc = CustomerCode.toUpperCase();
  let stop = route.Stops.find((s) => s.CustomerCode === cc);
  if (!stop) {
    stop = {
      StopIndex: route.Stops.length + 1,
      CustomerCode: cc,
      Address: Address ?? order.Address ?? "",
      OrderIDs: [],
      OrderCodes: [],
      PlannedServiceTime: 0,
      StopStatus: "PENDING"
    };
    route.Stops.push(stop);
    stop = route.Stops[route.Stops.length - 1];
  }
  stop.OrderIDs.push(order._id);
  stop.OrderCodes.push(order.OrderCode);

  if (order.PlanningStatus === PlanningStatus.PENDING) {
    order.PlanningStatus = PlanningStatus.PLANNED;
    order.PlanningHistory.push({ FromStatus: PlanningStatus.PENDING, ToStatus: PlanningStatus.PLANNED, ChangedBy: req.user._id });
    await order.save();
  }
  await refreshRouteMetrics(route, plan.OrganizationID);
  await route.save();
  res.json({ success: true, data: route });
}

/**
 * DELETE /api/route-plans/:planId/routes/:routeId/orders/:orderId
 */
export async function removeOrderFromRoute(req, res) {
  checkRoutePlanPermission(req, "update");
  const plan = await RoutePlan.findById(req.params.planId);
  if (!plan) throw new ApiError(404, "Route Plan not found");
  assertOrgInScope(req.orgScope, plan.OrganizationID);

  const route = await DeliveryRoute.findOne({ _id: req.params.routeId, RoutePlanID: plan._id });
  if (!route) throw new ApiError(404, "Route not found");
  if (route.Status !== RouteStatus.PLANNED) throw new ApiError(409, "Route is locked/finalized");

  const orderIdStr = req.params.orderId;
  let found = false;
  for (const stop of route.Stops) {
    const idx = stop.OrderIDs.map(String).indexOf(orderIdStr);
    if (idx !== -1) {
      stop.OrderIDs.splice(idx, 1);
      stop.OrderCodes.splice(idx, 1);
      found = true;
    }
  }
  route.Stops = route.Stops.filter((s) => s.OrderIDs.length > 0);
  route.Stops.forEach((s, i) => { s.StopIndex = i + 1; });

  if (!found) throw new ApiError(404, "Order not in this route");
  await refreshRouteMetrics(route, plan.OrganizationID);
  await route.save();

  const order = await SalesOrder.findById(orderIdStr);
  if (order && order.PlanningStatus === PlanningStatus.PLANNED) {
    order.PlanningStatus = PlanningStatus.PENDING;
    order.PlanningHistory.push({ FromStatus: PlanningStatus.PLANNED, ToStatus: PlanningStatus.PENDING, ChangedBy: req.user._id, Note: "Removed from route" });
    await order.save();
  }
  res.json({ success: true, data: route });
}

/* ── Lock / Finalize ── */

/** POST /api/route-plans/:planId/routes/:routeId/lock */
export async function lockRoute(req, res) {
  checkRoutePlanPermission(req, RoutePlanActions.LOCK);
  const plan = await RoutePlan.findById(req.params.planId);
  if (!plan) throw new ApiError(404, "Route Plan not found");
  assertOrgInScope(req.orgScope, plan.OrganizationID);

  const route = await DeliveryRoute.findOne({ _id: req.params.routeId, RoutePlanID: plan._id });
  if (!route) throw new ApiError(404, "Route not found");
  if (route.Status !== RouteStatus.PLANNED) throw new ApiError(409, `Route is already ${route.Status}`);
  if (route.Stops.length === 0) throw new ApiError(400, "Cannot lock empty route");
  if (route.IsOutsourced) {
    if (!route.ServiceID) throw new ApiError(400, "Chọn dịch vụ 3PL trước khi khóa lộ trình");
  } else if (!route.DriverID) {
    const orgSubtreeIds = await collectOrgSubtreeIds(plan.OrganizationID);
    const usedDriverIds = new Set((await DeliveryRoute.find({
      RoutePlanID: plan._id,
      _id: { $ne: route._id },
      DriverID: { $ne: null }
    }, { DriverID: 1 }).lean()).map((r) => String(r.DriverID)));
    const autoDriver = await findAvailableDriver(orgSubtreeIds, usedDriverIds);
    if (!autoDriver) throw new ApiError(400, "Chọn tài xế trước khi khóa lộ trình");
    route.DriverID = autoDriver._id;
    route.DriverCode = autoDriver.DriverCode ?? "";
  }

  route.Status = RouteStatus.LOCKED;
  await route.save();

  const ids = collectOrderIDs(route);
  await bulkUpdateOrderPlanningStatus(ids, PlanningStatus.PLANNED, PlanningStatus.LOCKED, req.user._id);

  if (plan.Status === RoutePlanStatus.DRAFT) {
    plan.Status = RoutePlanStatus.LOCKED;
    await plan.save();
  }
  res.json({ success: true, data: route });
}

/** POST /api/route-plans/:planId/routes/:routeId/unlock */
export async function unlockRoute(req, res) {
  checkRoutePlanPermission(req, RoutePlanActions.UNLOCK);
  const plan = await RoutePlan.findById(req.params.planId);
  if (!plan) throw new ApiError(404, "Route Plan not found");
  assertOrgInScope(req.orgScope, plan.OrganizationID);

  const route = await DeliveryRoute.findOne({ _id: req.params.routeId, RoutePlanID: plan._id });
  if (!route) throw new ApiError(404, "Route not found");
  if (route.Status !== RouteStatus.LOCKED) throw new ApiError(409, "Route is not locked");

  route.Status = RouteStatus.PLANNED;
  await route.save();

  const ids = collectOrderIDs(route);
  await bulkUpdateOrderPlanningStatus(ids, PlanningStatus.LOCKED, PlanningStatus.PLANNED, req.user._id);
  res.json({ success: true, data: route });
}

/** POST /api/route-plans/:planId/routes/:routeId/finalize */
export async function finalizeRoute(req, res) {
  checkRoutePlanPermission(req, RoutePlanActions.FINALIZE);
  const plan = await RoutePlan.findById(req.params.planId);
  if (!plan) throw new ApiError(404, "Route Plan not found");
  assertOrgInScope(req.orgScope, plan.OrganizationID);

  const route = await DeliveryRoute.findOne({ _id: req.params.routeId, RoutePlanID: plan._id });
  if (!route) throw new ApiError(404, "Route not found");
  if (route.Status !== RouteStatus.LOCKED) throw new ApiError(409, "Route must be LOCKED before finalizing");

  route.Status = RouteStatus.FINALIZED;
  await route.save();

  const ids = collectOrderIDs(route);
  await bulkUpdateOrderPlanningStatus(ids, PlanningStatus.LOCKED, PlanningStatus.FINALIZED, req.user._id);

  const allRoutes = await DeliveryRoute.find({ RoutePlanID: plan._id });
  const allFinalized = allRoutes.every((r) => r.Status === RouteStatus.FINALIZED);
  if (allFinalized && allRoutes.length > 0) {
    plan.Status = RoutePlanStatus.FINALIZED;
    await plan.save();
  }
  res.json({ success: true, data: route });
}

/** POST /api/route-plans/:planId/move-order
 *  Body: { orderId, toRouteId }
 *  Move an order from its current PLANNED route to another PLANNED route after
 *  validating capacity, vehicle capability, and handling-class compatibility.
 */
export async function moveOrderBetweenRoutes(req, res) {
  checkRoutePlanPermission(req, "update");
  const plan = await RoutePlan.findById(req.params.planId);
  if (!plan) throw new ApiError(404, "Route Plan not found");
  assertOrgInScope(req.orgScope, plan.OrganizationID);

  const { orderId, toRouteId } = req.body ?? {};
  if (!orderId || !toRouteId) throw new ApiError(400, "orderId và toRouteId là bắt buộc");

  const order = await SalesOrder.findById(orderId);
  if (!order) throw new ApiError(404, "Order not found");
  if (order.PlanningStatus !== PlanningStatus.PLANNED) {
    throw new ApiError(409, `Đơn hàng đã ở trạng thái ${order.PlanningStatus}, không thể chuyển lộ trình`);
  }
  const orgSubtreeIds = await collectOrgSubtreeIds(plan.OrganizationID);
  if (!orgSubtreeIds.some((id) => String(id) === String(order.OrganizationID))) {
    throw new ApiError(400, "Đơn hàng không thuộc tổ chức/chi nhánh/kho của kế hoạch này");
  }

  const allRoutes = await DeliveryRoute.find({ RoutePlanID: plan._id });
  const fromRoute = allRoutes.find((r) => r.Stops.some((s) => s.OrderIDs.map(String).includes(String(order._id))));
  if (!fromRoute) throw new ApiError(404, "Đơn hàng không thuộc lộ trình nào trong kế hoạch này");
  const toRoute = allRoutes.find((r) => String(r._id) === String(toRouteId));
  if (!toRoute) throw new ApiError(404, "Lộ trình đích không tồn tại");
  if (String(fromRoute._id) === String(toRoute._id)) throw new ApiError(400, "Lộ trình nguồn và đích trùng nhau");
  if (fromRoute.Status !== RouteStatus.PLANNED) throw new ApiError(409, `Lộ trình nguồn đang ở trạng thái ${fromRoute.Status}, không thể chuyển`);
  if (toRoute.Status !== RouteStatus.PLANNED) throw new ApiError(409, `Lộ trình đích đang ở trạng thái ${toRoute.Status}, không thể nhận đơn`);

  /* Compute order's weight/volume + categories */
  const prodCodes = (order.Items ?? []).map((i) => i.ProductCode);
  const prodDocs = await Product.find({ OrganizationID: { $in: orgSubtreeIds }, ProductCode: { $in: prodCodes } }).lean();
  const prodMap = Object.fromEntries(prodDocs.map((p) => [p.ProductCode, p]));
  const catIds = [...new Set(prodDocs.map((p) => p.CategoryID).filter(Boolean).map(String))];
  const catDocs = await ProductCategory.find({ _id: { $in: catIds } }).lean();
  const catMap = Object.fromEntries(catDocs.map((c) => [String(c._id), c]));

  let orderWeight = 0, orderVolume = 0;
  const orderRequiredCaps = new Set();
  const orderClasses = new Set();
  const orderIncompat = new Set();
  for (const item of order.Items ?? []) {
    const prod = prodMap[item.ProductCode];
    const cases = item.NumberOfCases ?? 0;
    orderWeight += cases * (prod?.WeightPerCase ?? 10);
    orderVolume += cases * (prod?.VolumePerCase ?? 0.02);
    const cat = prod?.CategoryID ? catMap[String(prod.CategoryID)] : null;
    if (cat?.RequiredCapability) orderRequiredCaps.add(cat.RequiredCapability);
    if (cat?.HandlingClass) orderClasses.add(cat.HandlingClass);
    (cat?.IncompatibleClasses ?? []).forEach((c) => orderIncompat.add(c));
  }

  /* Validate target vehicle capability */
  const toVehicle = await Vehicle.findById(toRoute.VehicleID).lean();
  if (!toVehicle) throw new ApiError(404, "Xe của lộ trình đích không tồn tại");
  const toCaps = new Set(toVehicle.Capabilities ?? []);
  const missing = [...orderRequiredCaps].find((c) => !toCaps.has(c));
  if (missing) throw new ApiError(409, `Xe ${toVehicle.VehicleCode} không hỗ trợ năng lực: ${missing}`);

  /* Validate target capacity */
  const newWeight = (toRoute.TotalWeight ?? 0) + orderWeight;
  const newVolume = (toRoute.TotalVolume ?? 0) + orderVolume;
  if (toVehicle.MaxWeight > 0 && newWeight > toVehicle.MaxWeight) {
    throw new ApiError(409, `Vượt tải trọng xe ${toVehicle.VehicleCode}: ${Math.round(newWeight)}kg > ${toVehicle.MaxWeight}kg`);
  }
  if (toVehicle.MaxVolume > 0 && newVolume > toVehicle.MaxVolume) {
    throw new ApiError(409, `Vượt thể tích xe ${toVehicle.VehicleCode}: ${newVolume.toFixed(2)} m³ > ${toVehicle.MaxVolume} m³`);
  }

  /* Validate handling-class compatibility against target route's existing orders */
  const existingOrderIds = toRoute.Stops.flatMap((s) => s.OrderIDs.map(String));
  if (existingOrderIds.length) {
    const existingOrders = await SalesOrder.find({ _id: { $in: existingOrderIds } }).lean();
    const existingProdCodes = [...new Set(existingOrders.flatMap((o) => (o.Items ?? []).map((i) => i.ProductCode)))];
    const existingProds = existingProdCodes.length
      ? await Product.find({ OrganizationID: { $in: orgSubtreeIds }, ProductCode: { $in: existingProdCodes } }).lean()
      : [];
    const existingCatIds = [...new Set(existingProds.map((p) => p.CategoryID).filter(Boolean).map(String))];
    const existingCats = existingCatIds.length
      ? await ProductCategory.find({ _id: { $in: existingCatIds } }).lean()
      : [];
    const existingCatMap = Object.fromEntries(existingCats.map((c) => [String(c._id), c]));
    const existingProdMap = Object.fromEntries(existingProds.map((p) => [p.ProductCode, p]));

    const targetClasses = new Set();
    const targetIncompat = new Set();
    for (const o of existingOrders) {
      for (const item of o.Items ?? []) {
        const cat = existingProdMap[item.ProductCode]?.CategoryID
          ? existingCatMap[String(existingProdMap[item.ProductCode].CategoryID)]
          : null;
        if (cat?.HandlingClass) targetClasses.add(cat.HandlingClass);
        (cat?.IncompatibleClasses ?? []).forEach((c) => targetIncompat.add(c));
      }
    }
    const conflict = [...orderClasses].find((cls) => targetIncompat.has(cls))
                  ?? [...targetClasses].find((cls) => orderIncompat.has(cls));
    if (conflict) {
      throw new ApiError(409, `Hàng hạng ${conflict} không tương thích với hàng đang có trên xe ${toVehicle.VehicleCode}`);
    }
  }

  /* Atomically move: remove from source stop, add to (or create) target stop */
  for (const stop of fromRoute.Stops) {
    const idx = stop.OrderIDs.map(String).indexOf(String(order._id));
    if (idx !== -1) { stop.OrderIDs.splice(idx, 1); stop.OrderCodes.splice(idx, 1); }
  }
  fromRoute.Stops = fromRoute.Stops.filter((s) => s.OrderIDs.length > 0);
  fromRoute.Stops.forEach((s, i) => { s.StopIndex = i + 1; });
  fromRoute.TotalWeight = Math.max(0, (fromRoute.TotalWeight ?? 0) - orderWeight);
  fromRoute.TotalVolume = Math.max(0, (fromRoute.TotalVolume ?? 0) - orderVolume);

  let targetStop = toRoute.Stops.find((s) => s.CustomerCode === order.CustomerCode);
  if (!targetStop) {
    toRoute.Stops.push({
      StopIndex: toRoute.Stops.length + 1,
      CustomerCode: order.CustomerCode,
      Address: "",
      OrderIDs: [order._id],
      OrderCodes: [order.OrderCode],
      PlannedServiceTime: 0,
      StopStatus: "PENDING"
    });
  } else {
    targetStop.OrderIDs.push(order._id);
    targetStop.OrderCodes.push(order.OrderCode);
  }
  toRoute.TotalWeight = newWeight;
  toRoute.TotalVolume = newVolume;

  await refreshRouteMetrics(fromRoute, plan.OrganizationID);
  await refreshRouteMetrics(toRoute, plan.OrganizationID);

  await fromRoute.save();
  await toRoute.save();

  res.json({ success: true, data: { fromRoute, toRoute } });
}

/** POST /api/route-plans/:planId/reorder-order
 * Body: { orderId, toRouteId, toIndex }
 * Moves an order to another route or reorders it inside the same route, then
 * recomputes stop order, arrival times, distance and estimated cost.
 */
export async function reorderOrder(req, res) {
  checkRoutePlanPermission(req, "update");
  const plan = await RoutePlan.findById(req.params.planId);
  if (!plan) throw new ApiError(404, "Route Plan not found");
  assertOrgInScope(req.orgScope, plan.OrganizationID);

  const { orderId, toRouteId, toIndex } = req.body ?? {};
  if (!orderId || !toRouteId) throw new ApiError(400, "orderId và toRouteId là bắt buộc");

  const order = await SalesOrder.findById(orderId);
  if (!order) throw new ApiError(404, "Order not found");
  if (order.PlanningStatus !== PlanningStatus.PLANNED) {
    throw new ApiError(409, `Đơn hàng đã ở trạng thái ${order.PlanningStatus}, không thể kéo-thả`);
  }
  const orgSubtreeIds = await collectOrgSubtreeIds(plan.OrganizationID);
  if (!orgSubtreeIds.some((id) => String(id) === String(order.OrganizationID))) {
    throw new ApiError(400, "Đơn hàng không thuộc tổ chức/chi nhánh/kho của kế hoạch này");
  }

  const routes = await DeliveryRoute.find({ RoutePlanID: plan._id });
  const fromRoute = routes.find((route) => route.Stops.some((stop) => stop.OrderIDs.map(String).includes(String(order._id))));
  const toRoute = routes.find((route) => String(route._id) === String(toRouteId));
  if (!fromRoute) throw new ApiError(404, "Đơn hàng không thuộc lộ trình nào trong kế hoạch này");
  if (!toRoute) throw new ApiError(404, "Lộ trình đích không tồn tại");
  if (fromRoute.Status !== RouteStatus.PLANNED || toRoute.Status !== RouteStatus.PLANNED) {
    throw new ApiError(409, "Chỉ được kéo-thả đơn trên lộ trình PLANNED");
  }

  const sameRoute = String(fromRoute._id) === String(toRoute._id);
  if (!sameRoute) {
    const prodCodes = (order.Items ?? []).map((item) => item.ProductCode);
    const prodDocs = prodCodes.length
      ? await Product.find({ OrganizationID: { $in: orgSubtreeIds }, ProductCode: { $in: prodCodes } }).lean()
      : [];
    const prodMap = Object.fromEntries(prodDocs.map((product) => [product.ProductCode, product]));
    let orderWeight = 0;
    let orderVolume = 0;
    for (const item of order.Items ?? []) {
      const product = prodMap[item.ProductCode];
      const cases = item.NumberOfCases ?? 0;
      orderWeight += cases * (product?.WeightPerCase ?? 10);
      orderVolume += cases * (product?.VolumePerCase ?? 0.02);
    }
    const vehicle = await Vehicle.findById(toRoute.VehicleID).lean();
    if (!vehicle) throw new ApiError(404, "Xe của lộ trình đích không tồn tại");
    const newWeight = (toRoute.TotalWeight ?? 0) + orderWeight;
    const newVolume = (toRoute.TotalVolume ?? 0) + orderVolume;
    if (vehicle.MaxWeight > 0 && newWeight > vehicle.MaxWeight) {
      throw new ApiError(409, `Vượt tải trọng xe ${vehicle.VehicleCode}: ${Math.round(newWeight)}kg > ${vehicle.MaxWeight}kg`);
    }
    if (vehicle.MaxVolume > 0 && newVolume > vehicle.MaxVolume) {
      throw new ApiError(409, `Vượt thể tích xe ${vehicle.VehicleCode}: ${newVolume.toFixed(2)} m³ > ${vehicle.MaxVolume} m³`);
    }
  }

  for (const stop of fromRoute.Stops) {
    const idx = stop.OrderIDs.map(String).indexOf(String(order._id));
    if (idx !== -1) {
      stop.OrderIDs.splice(idx, 1);
      stop.OrderCodes.splice(idx, 1);
      break;
    }
  }
  fromRoute.Stops = fromRoute.Stops.filter((stop) => stop.OrderIDs.length > 0);

  const target = sameRoute ? fromRoute : toRoute;
  const customer = await Customer.findOne({
    OrganizationID: { $in: orgSubtreeIds },
    CustomerCode: order.CustomerCode
  }).lean();
  const existingStop = target.Stops.find((stop) => stop.CustomerCode === order.CustomerCode);
  if (existingStop) {
    existingStop.OrderIDs.push(order._id);
    existingStop.OrderCodes.push(order.OrderCode);
  } else {
    const insertAt = Math.max(0, Math.min(Number.isFinite(Number(toIndex)) ? Number(toIndex) : target.Stops.length, target.Stops.length));
    target.Stops.splice(insertAt, 0, {
      StopIndex: insertAt + 1,
      CustomerCode: order.CustomerCode,
      Address: customer?.Address ?? "",
      Latitude: customer?.Latitude ?? null,
      Longitude: customer?.Longitude ?? null,
      OrderIDs: [order._id],
      OrderCodes: [order.OrderCode],
      PlannedServiceTime: customer?.ServiceTime ?? 0,
      StopStatus: "PENDING"
    });
  }

  await refreshRouteMetrics(fromRoute, plan.OrganizationID);
  if (!sameRoute) await refreshRouteMetrics(toRoute, plan.OrganizationID);

  await fromRoute.save();
  if (!sameRoute) await toRoute.save();

  res.json({ success: true, data: sameRoute ? { route: fromRoute } : { fromRoute, toRoute } });
}

/** PATCH /api/route-plans/:planId/routes/:routeId/assignment
 *  Body: { driverId?, serviceId?, isOutsourced? }
 *  Auto-computes EstimatedCost from Vehicle.CostPerKm/FixedCost or Service pricing.
 */
export async function assignRoute(req, res) {
  checkRoutePlanPermission(req, RoutePlanActions.UPDATE ?? "UPDATE");
  const plan = await RoutePlan.findById(req.params.planId);
  if (!plan) throw new ApiError(404, "Route Plan not found");
  assertOrgInScope(req.orgScope, plan.OrganizationID);

  const route = await DeliveryRoute.findOne({ _id: req.params.routeId, RoutePlanID: plan._id });
  if (!route) throw new ApiError(404, "Route not found");
  if (route.Status === RouteStatus.FINALIZED) throw new ApiError(409, "Cannot reassign a finalized route");

  const { driverId, serviceId, isOutsourced, shift, vehicleId } = req.body ?? {};

  if (typeof isOutsourced === "boolean") route.IsOutsourced = isOutsourced;
  if (shift && ["MORNING", "AFTERNOON", "FULL_DAY"].includes(shift)) route.Shift = shift;

  /* ── Swap vehicle on this route (validates capacity + capability against current stops) ── */
  if (vehicleId && String(vehicleId) !== String(route.VehicleID)) {
    if (route.Status === RouteStatus.LOCKED) throw new ApiError(409, "Route đang khóa — mở khóa trước khi đổi xe");
    const newVehicle = await Vehicle.findById(vehicleId).lean();
    if (!newVehicle) throw new ApiError(404, "Xe không tồn tại");
    if (newVehicle.Status !== "Active") throw new ApiError(400, `Xe ${newVehicle.VehicleCode} đang Inactive`);
    if (String(newVehicle.OrganizationID) !== String(plan.OrganizationID)) {
      throw new ApiError(400, "Xe không thuộc kho lập kế hoạch này");
    }
    const orgSubtreeIds = await collectOrgSubtreeIds(plan.OrganizationID);
    /* Cannot pick a vehicle already used by another route in same plan */
    const conflict = await DeliveryRoute.findOne({
      RoutePlanID: plan._id, VehicleID: vehicleId, _id: { $ne: route._id }
    }).lean();
    if (conflict) throw new ApiError(409, `Xe ${newVehicle.VehicleCode} đã dùng cho route ${conflict.VehicleCode} trong kế hoạch này`);

    /* Capacity check */
    if (newVehicle.MaxWeight > 0 && (route.TotalWeight ?? 0) > newVehicle.MaxWeight) {
      throw new ApiError(409, `Xe ${newVehicle.VehicleCode} không đủ tải: ${route.TotalWeight}kg > ${newVehicle.MaxWeight}kg`);
    }
    if (newVehicle.MaxVolume > 0 && (route.TotalVolume ?? 0) > newVehicle.MaxVolume) {
      throw new ApiError(409, `Xe ${newVehicle.VehicleCode} không đủ thể tích: ${route.TotalVolume}m³ > ${newVehicle.MaxVolume}m³`);
    }

    /* Capability check vs all orders currently on this route */
    const orderIds = route.Stops.flatMap((s) => s.OrderIDs.map(String));
    if (orderIds.length) {
      const orders = await SalesOrder.find({ _id: { $in: orderIds } }).lean();
      const prodCodes = [...new Set(orders.flatMap((o) => (o.Items ?? []).map((i) => i.ProductCode)))];
      const prods = prodCodes.length
        ? await Product.find({ OrganizationID: { $in: orgSubtreeIds }, ProductCode: { $in: prodCodes } }).lean()
        : [];
      const catIds = [...new Set(prods.map((p) => p.CategoryID).filter(Boolean).map(String))];
      const cats = catIds.length ? await ProductCategory.find({ _id: { $in: catIds } }).lean() : [];
      const catMap = Object.fromEntries(cats.map((c) => [String(c._id), c]));
      const prodMap = Object.fromEntries(prods.map((p) => [p.ProductCode, p]));
      const required = new Set();
      for (const o of orders) for (const it of (o.Items ?? [])) {
        const cat = prodMap[it.ProductCode]?.CategoryID ? catMap[String(prodMap[it.ProductCode].CategoryID)] : null;
        if (cat?.RequiredCapability) required.add(cat.RequiredCapability);
      }
      const have = new Set(newVehicle.Capabilities ?? []);
      const missing = [...required].find((c) => !have.has(c));
      if (missing) throw new ApiError(409, `Xe ${newVehicle.VehicleCode} thiếu năng lực: ${missing}`);
    }

    route.VehicleID = newVehicle._id;
    route.VehicleCode = newVehicle.VehicleCode;
  }

  if (driverId === null) {
    route.DriverID = null;
    route.DriverCode = "";
  } else if (driverId) {
    const driver = await Driver.findById(driverId);
    if (!driver) throw new ApiError(404, "Driver not found");
    route.DriverID = driver._id;
    route.DriverCode = driver.DriverCode ?? "";
  }

  if (serviceId === null) {
    route.ServiceID = null;
    route.ServiceCode = "";
  } else if (serviceId) {
    const service = await Service.findById(serviceId);
    if (!service) throw new ApiError(404, "Service not found");
    route.ServiceID = service._id;
    route.ServiceCode = service.ServiceCode ?? "";
  }

  /* Compute estimated cost */
  if (route.IsOutsourced && route.ServiceID) {
    const svc = await Service.findById(route.ServiceID).lean();
    const km  = route.TotalDistance ?? 0;
    const kg  = route.TotalWeight ?? 0;
    const cbm = route.TotalVolume ?? 0;
    const base = (svc.FlatRate ?? 0) + (svc.PricePerKm ?? 0) * km
               + (svc.PricePerKg ?? 0) * kg + (svc.PricePerCBM ?? 0) * cbm;
    const charged = Math.max(base, svc.MinCharge ?? 0);
    route.EstimatedCost = Math.round(charged * (1 + (svc.FuelSurchargePercent ?? 0) / 100));
  } else if (route.VehicleID) {
    const veh = await Vehicle.findById(route.VehicleID).lean();
    route.EstimatedCost = Math.round((veh?.FixedCost ?? 0) + (veh?.CostPerKm ?? 0) * (route.TotalDistance ?? 0));
  }

  /* If shift changed, recompute arrival times so they match new depart time */
  if (shift) {
    const veh = await Vehicle.findById(route.VehicleID).lean();
    const depotOrg = await resolveDepotForOrg(route.OrganizationID);
    const depot = depotOrg ? [depotOrg.Latitude, depotOrg.Longitude] : null;
    recomputeRouteTimings(route, veh, depot);
  }

  await route.save();
  res.json({ success: true, data: route });
}

/* ── Utility ── */

/** GET /api/route-plans/unplanned-orders?organizationId=&date= */
export async function getUnplannedOrders(req, res) {
  const { organizationId, date } = req.query;
  const filter = scopeFilter(req.orgScope, "OrganizationID");
  filter.PlanningStatus = PlanningStatus.PENDING;
  filter.ApprovalStatus = ApprovalStatus.APPROVED;
  filter.OrderStatus = { $nin: ["CANCELLED", "REJECTED"] };

  if (organizationId) {
    assertOrgInScope(req.orgScope, organizationId);
    filter.OrganizationID = { $in: await collectOrgSubtreeIds(organizationId) };
  }
  if (date) {
    filter.OrderDate = orderDateEligibleUntil(date);
  }

  const orders = await SalesOrder.find(filter).sort({ OrderDate: 1, OrderCode: 1 }).lean();
  res.json({ success: true, data: orders });
}

/* ════════════════════════════════════
   OPTIMIZE — Phase 1: NN + 2-opt
════════════════════════════════════ */

/** POST /api/route-plans/:id/optimize */
export async function optimizeRoutePlan(req, res) {
  checkRoutePlanPermission(req, RoutePlanActions.OPTIMIZE);

  const plan = await RoutePlan.findById(req.params.id).lean();
  if (!plan) throw new ApiError(404, "Route Plan not found");
  assertOrgInScope(req.orgScope, plan.OrganizationID);
  if (plan.Status === RoutePlanStatus.FINALIZED) throw new ApiError(409, "Cannot re-optimize a finalized plan");

  /* Re-optimize: reset all PLANNED routes (and their orders) so they go back into
     the pool. LOCKED / FINALIZED routes are preserved — their vehicles + orders
     are excluded from this run. */
  const allExistingRoutes = await DeliveryRoute.find({ RoutePlanID: plan._id });
  const lockedRoutes = allExistingRoutes.filter((r) => r.Status !== RouteStatus.PLANNED);
  const plannedRoutesToReset = allExistingRoutes.filter((r) => r.Status === RouteStatus.PLANNED);

  if (plannedRoutesToReset.length) {
    const orderIdsToReset = plannedRoutesToReset.flatMap((r) => r.Stops.flatMap((s) => s.OrderIDs.map(String)));
    if (orderIdsToReset.length) {
      await SalesOrder.updateMany({ _id: { $in: orderIdsToReset } }, { $set: { PlanningStatus: PlanningStatus.PENDING } });
    }
    await DeliveryRoute.deleteMany({ _id: { $in: plannedRoutesToReset.map((r) => r._id) } });
  }

  const lockedVehicleIds = new Set(lockedRoutes.map((r) => String(r.VehicleID)));
  const orgSubtreeIds = await collectOrgSubtreeIds(plan.OrganizationID);

  /* Load unplanned orders for this org + plan date (now includes the just-reset ones) */
  const orders = await SalesOrder.find({
    OrganizationID: { $in: orgSubtreeIds },
    PlanningStatus: PlanningStatus.PENDING,
    ApprovalStatus: ApprovalStatus.APPROVED,
    OrderStatus: { $nin: [OrderStatus.CANCELLED, OrderStatus.REJECTED] },
    OrderDate: orderDateEligibleUntil(plan.PlanDate)
  }).lean();

  if (!orders.length) throw new ApiError(400, "Không có đơn hàng nào để tối ưu (tất cả đã LOCKED hoặc chưa duyệt)");

  /* Customers for lat/lng */
  const custCodes = [...new Set(orders.map((o) => o.CustomerCode))];
  const custDocs = await Customer.find({ OrganizationID: { $in: orgSubtreeIds }, CustomerCode: { $in: custCodes } }).lean();
  const custMap = Object.fromEntries(custDocs.map((c) => [c.CustomerCode, c]));

  /* Products for accurate weight/volume */
  const prodCodes = [...new Set(orders.flatMap((o) => (o.Items ?? []).map((i) => i.ProductCode)))];
  const prodDocs = await Product.find({ OrganizationID: { $in: orgSubtreeIds }, ProductCode: { $in: prodCodes } }).lean();
  const prodMap = Object.fromEntries(prodDocs.map((p) => [p.ProductCode, p]));

  /* Product categories — for capability + incompat checks */
  const catIds = [...new Set(prodDocs.map((p) => p.CategoryID).filter(Boolean).map(String))];
  const catDocs = await ProductCategory.find({ _id: { $in: catIds } }).lean();
  const catMap = Object.fromEntries(catDocs.map((c) => [String(c._id), c]));

  /* Vehicles — exclude any already committed to LOCKED/FINALIZED routes */
  const allVehicles = await Vehicle.find({ OrganizationID: { $in: orgSubtreeIds }, Status: "Active" }).lean();
  const vehicles = allVehicles.filter((v) => !lockedVehicleIds.has(String(v._id)));
  if (!vehicles.length) throw new ApiError(400, "Không có phương tiện rảnh để tối ưu (tất cả đang dùng cho LOCKED routes)");

  /* Resolve the depot (warehouse) under this org — prefers a DEPOT-type
     descendant; falls back to the org itself or to a Hanoi default. */
  const depotOrg = await resolveDepotForOrg(plan.OrganizationID);
  if (!depotOrg) {
    throw new ApiError(400, "Tổ chức lập kế hoạch chưa có kho (OrgType=DEPOT) với tọa độ hợp lệ");
  }
  const depot = {
    lat: depotOrg.Latitude,
    lng: depotOrg.Longitude
  };

  /* Build stop map: one stop per customer, aggregate orders */
  const stopMap = {};
  const skippedOrders = [];
  const fleetCaps = new Set(vehicles.flatMap((v) => v.Capabilities ?? []));

  for (const order of orders) {
    const cust = custMap[order.CustomerCode];
    if (!cust?.Latitude || !cust?.Longitude) {
      skippedOrders.push({ code: order.OrderCode, reason: "Khách hàng thiếu tọa độ GPS" });
      continue;
    }

    /* derive required capabilities + handling classes from this order's items */
    const requiredCaps = new Set();
    const handlingClasses = new Set();
    const incompatClasses = new Set();
    for (const item of order.Items ?? []) {
      const prod = prodMap[item.ProductCode];
      const cat = prod?.CategoryID ? catMap[String(prod.CategoryID)] : null;
      if (cat?.RequiredCapability) requiredCaps.add(cat.RequiredCapability);
      if (cat?.HandlingClass) handlingClasses.add(cat.HandlingClass);
      (cat?.IncompatibleClasses ?? []).forEach((c) => incompatClasses.add(c));
    }

    /* skip if no vehicle in fleet has all required capabilities */
    const missingCap = [...requiredCaps].find((c) => !fleetCaps.has(c));
    if (missingCap) {
      skippedOrders.push({ code: order.OrderCode, reason: `Không có xe nào hỗ trợ năng lực: ${missingCap}` });
      continue;
    }

    if (!stopMap[order.CustomerCode]) {
      stopMap[order.CustomerCode] = {
        customerCode: order.CustomerCode,
        customerName: cust.XName,
        address:      cust.Address ?? "",
        lat:          cust.Latitude,
        lng:          cust.Longitude,
        serviceTime:  LIGHT_UNLOADING_MINUTES,
        caseCount: 0,
        weight: 0, volume: 0,
        requiredCapabilities: [],
        handlingClasses: [],
        incompatibleClasses: [],
        orders: []
      };
    }

    let orderWeight = 0, orderVolume = 0, orderCases = 0;
    for (const item of order.Items ?? []) {
      const prod = prodMap[item.ProductCode];
      const cases = item.NumberOfCases ?? 0;
      orderCases += cases;
      orderWeight += cases * (prod?.WeightPerCase ?? 10);
      orderVolume += cases * (prod?.VolumePerCase ?? 0.02);
    }

    const stop = stopMap[order.CustomerCode];
    stop.caseCount += orderCases;
    stop.weight += orderWeight;
    stop.volume += orderVolume;
    stop.serviceTime = stopServiceMinutes(null, stop);
    stop.requiredCapabilities = [...new Set([...stop.requiredCapabilities, ...requiredCaps])];
    stop.handlingClasses = [...new Set([...stop.handlingClasses, ...handlingClasses])];
    stop.incompatibleClasses = [...new Set([...stop.incompatibleClasses, ...incompatClasses])];
    stop.orders.push({ id: order._id, code: order.OrderCode });
  }

  /* check intra-stop incompatibility (e.g. food + chemical at same customer) */
  for (const code of Object.keys(stopMap)) {
    const s = stopMap[code];
    const conflict = s.handlingClasses.find((cls) => s.incompatibleClasses.includes(cls));
    if (conflict) {
      s.orders.forEach((o) => skippedOrders.push({ code: o.code, reason: `Hàng ${conflict} không tương thích với hàng khác cùng khách` }));
      delete stopMap[code];
    }
  }

  const stops = Object.values(stopMap);
  if (!stops.length) throw new ApiError(400, "Tất cả đơn hàng đều bị loại do thiếu tọa độ hoặc không tương thích phương tiện");

  const vehicleInput = vehicles.map((v) => ({
    id: String(v._id), code: v.VehicleCode, maxWeight: v.MaxWeight ?? 0, maxVolume: v.MaxVolume ?? 0,
    capabilities: v.Capabilities ?? [],
    avgSpeedKmh: v.AvgSpeedKmh ?? DEFAULT_URBAN_SPEED_KMH,
    loadingTime: v.LoadingTime ?? DEFAULT_LOADING_MINUTES,
    unloadingTimePerStop: v.UnloadingTimePerStop ?? HEAVY_UNLOADING_MINUTES
  }));

  /* Algorithm selection.
     - "hgs"    (default): Hybrid Genetic Search via Python optimizer-service
     - "lns-sa": LNS + Simulated Annealing via Python optimizer-service
     - "nn2opt": Nearest Neighbor + 2-opt via Python optimizer-service
     - "legacy": original Node.js routeOptimizer (kept as fallback for offline dev)
  */
  const algorithm = (req.query.algorithm ?? req.body?.algorithm ?? "hgs").toString();
  const maxSeconds = Number(req.query.maxSeconds ?? req.body?.maxSeconds ?? 15);

  let optimized;
  let algorithmLabel;
  let optimizerStats = null;

  async function runLegacy() {
    const r = optimizeRoutes({ depot, vehicles: vehicleInput, stops });
    return { routes: r, label: "legacy: NN + 2-opt + LNS-SA (Node.js)" };
  }

  if ((plan.Shift ?? "FULL_DAY") === "FULL_DAY") {
    const packed = buildFullDayPackedRoutes({ depot, vehicles: vehicleInput, stops });
    optimized = packed.routes;
    for (const stop of packed.unassigned) {
      stop.orders.forEach((order) => skippedOrders.push({
        code: order.code,
        reason: "Không đủ tải/thể tích hoặc thời gian 08:00-17:30 sau khi đã xếp các xe trước"
      }));
    }
    algorithmLabel = "full-day packer: ưu tiên gom đầy xe theo ngày";
  } else if (["MORNING", "AFTERNOON"].includes(plan.Shift)) {
    const packed = buildShiftConstrainedRoutes({ depot, vehicles: vehicleInput, stops, shift: plan.Shift });
    optimized = packed.routes;
    const windowLabel = plan.Shift === "MORNING" ? "08:00-12:00" : "13:30-17:30";
    for (const stop of packed.unassigned) {
      stop.orders.forEach((order) => skippedOrders.push({
        code: order.code,
        reason: `Không đủ tải/thể tích hoặc thời gian ${windowLabel} sau khi đã xếp các xe trước`
      }));
    }
    algorithmLabel = `shift packer: ép xe quay về kho trong khung ${windowLabel}`;
  } else if (algorithm === "legacy") {
    const r = await runLegacy();
    optimized = r.routes;
    algorithmLabel = r.label;
  } else {
    try {
      const result = await callOptimizer({
        depot, vehicles: vehicleInput, stops, algorithm, maxSeconds, seed: 42
      });
      optimized = result.routes;
      optimizerStats = {
        totalDistance: result.totalDistance,
        feasible:      result.feasible,
        elapsedSec:    result.elapsedSec,
        stats:         result.stats
      };
      algorithmLabel = ({
        "hgs":    "HGS — Hybrid Genetic Search (Vidal 2022)",
        "lns-sa": "LNS + Simulated Annealing",
        "nn2opt": "Nearest Neighbor + 2-opt"
      })[algorithm] ?? algorithm;
    } catch (err) {
      /* Python optimiser microservice unreachable — fall back to the bundled
         Node.js heuristic so the planner is never blocked in offline dev. */
      // eslint-disable-next-line no-console
      console.warn(`[Optimize] Python service failed (${err.message}) — falling back to legacy Node.js solver`);
      const r = await runLegacy();
      optimized = r.routes;
      algorithmLabel = `${r.label} (fallback: Python service không phản hồi)`;
    }
  }

  if (!optimized?.length) {
    throw new ApiError(400, "Không tạo được lộ trình nào: không đủ xe phù hợp hoặc vượt thời gian làm việc");
  }

  /* Create DeliveryRoute documents (PLANNED routes were already wiped at the
     top of this handler; LOCKED/FINALIZED routes from previous runs are kept) */
  const createdRoutes = [];
  const plannedOrderIDs = [];
  const usedDriverIdsForOptimize = new Set(lockedRoutes.map((r) => String(r.DriverID ?? "")).filter(Boolean));
  const availableDriversForOptimize = await Driver.find({ OrganizationID: { $in: orgSubtreeIds }, Status: "Active" }).sort({ DriverCode: 1 }).lean();

  for (const route of optimized) {
    const routeStops = route.stops.map((s) => ({
      StopIndex:           s.stopIndex,
      CustomerCode:        s.customerCode,
      Address:             s.address,
      Latitude:            s.lat ?? null,
      Longitude:           s.lng ?? null,
      OrderIDs:            s.orders.map((o) => o.id),
      OrderCodes:          s.orders.map((o) => o.code),
      CaseCount:           s.caseCount ?? 0,
      PlannedArrivalTime:  s.plannedArrival,
      PlannedDepartureTime: "",
      PlannedServiceTime:  s.serviceTime
    }));

    const planShift = plan.Shift ?? "FULL_DAY";
    const autoDriver = availableDriversForOptimize.find((d) => !usedDriverIdsForOptimize.has(String(d._id))) ?? null;
    if (autoDriver) usedDriverIdsForOptimize.add(String(autoDriver._id));
    const dr = await DeliveryRoute.create({
      RoutePlanID:    plan._id,
      OrganizationID: plan.OrganizationID,
      VehicleID:      route.vehicleID,
      VehicleCode:    route.vehicleCode,
      DriverID:       autoDriver?._id ?? null,
      DriverCode:     autoDriver?.DriverCode ?? "",
      Shift:          planShift,
      Status:         RouteStatus.PLANNED,
      Stops:          routeStops,
      TotalDistance:  route.totalDistance,
      TotalWeight:    route.totalWeight,
      TotalVolume:    route.totalVolume
    });
    /* Recompute arrivals so each route's stops respect its own Shift depart time */
    const veh = await Vehicle.findById(route.vehicleID).lean();
    recomputeRouteTimings(dr, veh, [depot.lat, depot.lng]);
    await recomputeEstimatedCost(dr);
    await dr.save();

    createdRoutes.push(dr);

    for (const s of route.stops) {
      for (const o of s.orders) plannedOrderIDs.push(o.id);
    }
  }

  await SalesOrder.updateMany({ _id: { $in: plannedOrderIDs } }, { $set: { PlanningStatus: PlanningStatus.PLANNED } });

  res.json({
    success: true,
    data: {
      algorithm:     algorithmLabel,
      optimizerStats,
      routesCreated: createdRoutes.length,
      ordersPlanned: plannedOrderIDs.length,
      skipped:       skippedOrders,
      routes:        createdRoutes.map((r) => ({
        _id:           r._id,
        VehicleCode:   r.VehicleCode,
        TotalDistance: r.TotalDistance,
        TotalWeight:   r.TotalWeight,
        TotalVolume:   r.TotalVolume,
        Stops:         r.Stops.length
      }))
    }
  });
}

/**
 * Run all 3 algorithms (NN+2opt, LNS+SA, HGS) on the same plan input and
 * return a comparison table. Does NOT modify the database — read-only,
 * intended for the thesis demo screen.
 */
export async function benchmarkRoutePlan(req, res) {
  checkRoutePlanPermission(req, RoutePlanActions.OPTIMIZE);

  const plan = await RoutePlan.findById(req.params.id).lean();
  if (!plan) throw new ApiError(404, "Route Plan not found");
  assertOrgInScope(req.orgScope, plan.OrganizationID);

  const orgSubtreeIds = await collectOrgSubtreeIds(plan.OrganizationID);

  const orders = await SalesOrder.find({
    OrganizationID: { $in: orgSubtreeIds },
    PlanningStatus: PlanningStatus.PENDING,
    ApprovalStatus: ApprovalStatus.APPROVED,
    OrderStatus: { $nin: [OrderStatus.CANCELLED, OrderStatus.REJECTED] },
    OrderDate: orderDateEligibleUntil(plan.PlanDate)
  }).lean();
  if (!orders.length) throw new ApiError(400, "Không có đơn hàng PENDING cho ngày lập kế hoạch này");

  const custCodes = [...new Set(orders.map((o) => o.CustomerCode))];
  const custDocs = await Customer.find({ OrganizationID: { $in: orgSubtreeIds }, CustomerCode: { $in: custCodes } }).lean();
  const custMap = Object.fromEntries(custDocs.map((c) => [c.CustomerCode, c]));

  const prodCodes = [...new Set(orders.flatMap((o) => (o.Items ?? []).map((i) => i.ProductCode)))];
  const prodDocs = await Product.find({ OrganizationID: { $in: orgSubtreeIds }, ProductCode: { $in: prodCodes } }).lean();
  const prodMap = Object.fromEntries(prodDocs.map((p) => [p.ProductCode, p]));

  const vehicles = await Vehicle.find({ OrganizationID: { $in: orgSubtreeIds }, Status: "Active" }).lean();
  if (!vehicles.length) throw new ApiError(400, "Không có phương tiện Active cho tổ chức này");

  const depotOrg = await resolveDepotForOrg(plan.OrganizationID);
  if (!depotOrg) {
    throw new ApiError(400, "Tổ chức lập kế hoạch chưa có kho (OrgType=DEPOT) với tọa độ hợp lệ");
  }
  const depot = { lat: depotOrg.Latitude, lng: depotOrg.Longitude };

  const stopMap = {};
  for (const order of orders) {
    const cust = custMap[order.CustomerCode];
    if (!cust?.Latitude || !cust?.Longitude) continue;
    if (!stopMap[order.CustomerCode]) {
      stopMap[order.CustomerCode] = {
        customerCode: order.CustomerCode,
        customerName: cust.XName,
        address:      cust.Address ?? "",
        lat:          cust.Latitude,
        lng:          cust.Longitude,
        serviceTime:  LIGHT_UNLOADING_MINUTES,
        caseCount: 0,
        weight: 0, volume: 0,
        orders: []
      };
    }
    let w = 0, v = 0;
    let caseCount = 0;
    for (const item of order.Items ?? []) {
      const prod = prodMap[item.ProductCode];
      const cs = item.NumberOfCases ?? 0;
      caseCount += cs;
      w += cs * (prod?.WeightPerCase ?? 10);
      v += cs * (prod?.VolumePerCase ?? 0.02);
    }
    stopMap[order.CustomerCode].caseCount += caseCount;
    stopMap[order.CustomerCode].serviceTime = stopServiceMinutes(null, stopMap[order.CustomerCode]);
    stopMap[order.CustomerCode].weight += w;
    stopMap[order.CustomerCode].volume += v;
    stopMap[order.CustomerCode].orders.push({ id: String(order._id), code: order.OrderCode });
  }

  const stops = Object.values(stopMap);
  if (!stops.length) throw new ApiError(400, "Tất cả đơn hàng đều thiếu tọa độ GPS khách hàng");

  const vehicleInput = vehicles.map((v) => ({
    id: String(v._id), code: v.VehicleCode, maxWeight: v.MaxWeight ?? 0, maxVolume: v.MaxVolume ?? 0
  }));

  const maxSeconds = Number(req.query.maxSeconds ?? req.body?.maxSeconds ?? 10);
  const result = await callBenchmark({ depot, vehicles: vehicleInput, stops, maxSeconds, seed: 42 });

  res.json({
    success: true,
    data: {
      planID:    plan._id,
      planDate:  plan.PlanDate,
      stops:     result.stops,
      vehicles:  result.vehicles,
      comparison: result.comparison
    }
  });
}
