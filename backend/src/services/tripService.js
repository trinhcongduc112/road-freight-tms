import { DeliveryRoute, RouteStatus } from "../models/DeliveryRoute.js";
import { RoutePlan } from "../models/RoutePlan.js";
import { Customer } from "../models/Customer.js";
import { Driver } from "../models/Driver.js";
import { SalesOrder } from "../models/SalesOrder.js";
import { Service } from "../models/Service.js";
import { Trip, TripStatus } from "../models/Trip.js";
import { Organization } from "../models/Organization.js";

function compactCode(value) {
  return String(value ?? "").trim().toUpperCase();
}

async function makeTripCode(route, plan) {
  const base = `${plan?.PlanCode ?? "RP"}-${route.VehicleCode || String(route.VehicleID).slice(-4)}`;
  const code = `TRIP-${compactCode(base).replace(/[^A-Z0-9-]/g, "-")}`;
  const existing = await Trip.findOne({ TripCode: code, DeliveryRouteID: { $ne: route._id } }).lean();
  return existing ? `${code}-${String(route._id).slice(-4).toUpperCase()}` : code;
}

export async function ensureTripForRouteId(routeId) {
  const route = await DeliveryRoute.findById(routeId);
  if (!route) return null;
  if (![RouteStatus.LOCKED, RouteStatus.FINALIZED].includes(route.Status)) return null;

  const plan = await RoutePlan.findById(route.RoutePlanID).lean();
  if (!plan) return null;

  const orderIds = route.Stops.flatMap((stop) => stop.OrderIDs ?? []);
  const [orders, customers, driver, service, depot] = await Promise.all([
    SalesOrder.find({ _id: { $in: orderIds } }).lean(),
    Customer.find({ OrganizationID: route.OrganizationID, CustomerCode: { $in: route.Stops.map((s) => s.CustomerCode) } }).lean(),
    route.DriverID ? Driver.findById(route.DriverID).lean() : null,
    route.ServiceID ? Service.findById(route.ServiceID).lean() : null,
    Organization.findById(route.OrganizationID).lean()
  ]);
  const orderById = new Map(orders.map((o) => [String(o._id), o]));
  const customerByCode = new Map(customers.map((c) => [compactCode(c.CustomerCode), c]));

  const tasks = route.Stops.map((stop) => {
    const customer = customerByCode.get(compactCode(stop.CustomerCode));
    const stopOrders = (stop.OrderIDs ?? []).map((id) => orderById.get(String(id))).filter(Boolean);
    return {
      StopIndex: stop.StopIndex,
      CustomerCode: stop.CustomerCode,
      CustomerName: customer?.XName ?? stop.CustomerCode,
      Address: stop.Address || customer?.Address || "",
      Latitude: stop.Latitude ?? customer?.Latitude ?? null,
      Longitude: stop.Longitude ?? customer?.Longitude ?? null,
      Phone: customer?.Phone ?? "",
      PlannedArrivalTime: stop.PlannedArrivalTime ?? "",
      PlannedDepartureTime: stop.PlannedDepartureTime ?? "",
      PlannedServiceTime: stop.PlannedServiceTime ?? 0,
      OrderIDs: stop.OrderIDs ?? [],
      OrderCodes: stop.OrderCodes ?? [],
      CODAmount: stopOrders.reduce((sum, o) => sum + Number(o.NumberCollected || o.TotalPrice || 0), 0),
      Status: stop.StopStatus === "COMPLETED" ? "COMPLETED" : stop.StopStatus === "FAILED" ? "FAILED" : "PENDING"
    };
  });

  const payload = {
    OrganizationID: route.OrganizationID,
    RoutePlanID: route.RoutePlanID,
    DeliveryRouteID: route._id,
    VehicleID: route.VehicleID,
    VehicleCode: route.VehicleCode,
    DepotCode: depot?.XCode ?? "",
    DepotName: depot?.XName ?? "",
    DepotAddress: depot?.Address ?? "",
    DepotLatitude: depot?.Latitude ?? null,
    DepotLongitude: depot?.Longitude ?? null,
    DriverID: route.DriverID ?? null,
    DriverUserID: driver?.LinkedUserID ?? null,
    DriverCode: driver?.DriverCode ?? route.DriverCode ?? "",
    DriverName: driver?.XName ?? route.DriverCode ?? "",
    DriverPhone: driver?.Phone ?? "",
    IsOutsourced: Boolean(route.IsOutsourced),
    ServiceID: route.ServiceID ?? null,
    ServiceCode: service?.ServiceCode ?? route.ServiceCode ?? "",
    ServiceName: service?.XName ?? route.ServiceCode ?? "",
    PlanDate: plan.PlanDate,
    PlannedStartTime: route.PlannedStartTime ?? "",
    PlannedReturnTime: route.PlannedReturnTime ?? "",
    TotalDistance: route.TotalDistance ?? 0,
    TotalWeight: route.TotalWeight ?? 0,
    EstimatedCost: route.EstimatedCost ?? 0,
    Tasks: tasks,
    Notes: route.Notes ?? ""
  };

  const existing = await Trip.findOne({ DeliveryRouteID: route._id });
  if (existing) {
    if ([TripStatus.IN_PROGRESS, TripStatus.RETURNING, TripStatus.COMPLETED].includes(existing.Status)) {
      existing.DepotCode = payload.DepotCode;
      existing.DepotName = payload.DepotName;
      existing.DepotAddress = payload.DepotAddress;
      existing.DepotLatitude = payload.DepotLatitude;
      existing.DepotLongitude = payload.DepotLongitude;
      existing.DriverID = payload.DriverID;
      existing.DriverUserID = payload.DriverUserID;
      existing.DriverCode = payload.DriverCode;
      existing.DriverName = payload.DriverName;
      existing.DriverPhone = payload.DriverPhone;
      return existing.save();
    }
    Object.assign(existing, payload);
    existing.Status = TripStatus.ASSIGNED;
    existing.CancelledAt = null;
    return existing.save();
  }

  return Trip.create({
    ...payload,
    TripCode: await makeTripCode(route, plan),
    Status: TripStatus.ASSIGNED
  });
}

export async function ensureTripsForPlanId(planId) {
  const routes = await DeliveryRoute.find({
    RoutePlanID: planId,
    Status: { $in: [RouteStatus.LOCKED, RouteStatus.FINALIZED] }
  });
  const trips = [];
  for (const route of routes) {
    const trip = await ensureTripForRouteId(route._id);
    if (trip) trips.push(trip);
  }
  return trips;
}

export async function cancelTripForRouteId(routeId) {
  const trip = await Trip.findOne({ DeliveryRouteID: routeId });
  if (!trip) return null;
  if ([TripStatus.IN_PROGRESS, TripStatus.RETURNING, TripStatus.COMPLETED].includes(trip.Status)) return trip;
  trip.Status = TripStatus.CANCELLED;
  trip.CancelledAt = new Date();
  return trip.save();
}
