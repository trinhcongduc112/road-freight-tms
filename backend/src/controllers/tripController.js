import { DeliveryRoute } from "../models/DeliveryRoute.js";
import { Driver } from "../models/Driver.js";
import { GpsLog } from "../models/GpsLog.js";
import { OrderStatus, SalesOrder } from "../models/SalesOrder.js";
import { Trip, TripStatus, TripTaskStatus } from "../models/Trip.js";
import { assertOrgInScope, scopeFilter } from "../middlewares/dac.js";
import { ApiError } from "../utils/apiError.js";
import { ensureTripForRouteId, ensureTripsForPlanId } from "../services/tripService.js";

const doneStatuses = [TripTaskStatus.COMPLETED, TripTaskStatus.FAILED];
const activeTripStatuses = [TripStatus.IN_PROGRESS, TripStatus.RETURNING, TripStatus.COMPLETED];

async function findDriverForUser(userId) {
  return Driver.findOne({ LinkedUserID: userId, Status: "Active" }).lean();
}

function nextTripStatus(tasks) {
  if (tasks.every((task) => doneStatuses.includes(task.Status))) return TripStatus.RETURNING;
  if (tasks.some((task) => task.Status !== TripTaskStatus.PENDING)) return TripStatus.IN_PROGRESS;
  return null;
}

export async function listTrips(req, res) {
  const routes = await DeliveryRoute.find({ ...scopeFilter(req.orgScope), Status: { $in: ["LOCKED", "FINALIZED"] } }, { _id: 1 }).lean();
  for (const route of routes) await ensureTripForRouteId(route._id);

  const filter = { ...scopeFilter(req.orgScope) };
  if (req.query.date) {
    const start = new Date(`${req.query.date}T00:00:00.000Z`);
    const end = new Date(start);
    end.setUTCDate(end.getUTCDate() + 1);
    filter.PlanDate = { $gte: start, $lt: end };
  }
  if (req.query.status) filter.Status = req.query.status;
  const trips = await Trip.find(filter).sort({ PlanDate: -1, VehicleCode: 1 }).lean();
  res.json({ success: true, data: trips });
}

export async function getTrip(req, res) {
  const trip = await Trip.findById(req.params.id).lean();
  if (!trip) throw new ApiError(404, "Trip not found");
  assertOrgInScope(req.orgScope, trip.OrganizationID);
  res.json({ success: true, data: trip });
}

export async function syncPlanTrips(req, res) {
  const trips = await ensureTripsForPlanId(req.params.planId);
  res.json({ success: true, data: trips });
}

export async function getMyTrips(req, res) {
  const driver = await findDriverForUser(req.user._id);
  if (!driver) throw new ApiError(403, "Tài khoản chưa liên kết tài xế");
  const routes = await DeliveryRoute.find({ DriverID: driver._id, Status: { $in: ["LOCKED", "FINALIZED"] } }, { _id: 1 }).lean();
  for (const route of routes) await ensureTripForRouteId(route._id);
  const trips = await Trip.find({ DriverID: driver._id, Status: { $ne: TripStatus.CANCELLED } })
    .sort({ PlanDate: -1, PlannedStartTime: 1 })
    .limit(20)
    .lean();
  res.json({ success: true, data: trips });
}

export async function getMyTrip(req, res) {
  const driver = await findDriverForUser(req.user._id);
  if (!driver) throw new ApiError(403, "Tài khoản chưa liên kết tài xế");
  const trip = await Trip.findOne({ _id: req.params.id, DriverID: driver._id }).lean();
  if (!trip) throw new ApiError(404, "Trip not found");
  res.json({ success: true, data: trip });
}

async function loadDriverTrip(req) {
  const driver = await findDriverForUser(req.user._id);
  if (!driver) throw new ApiError(403, "Tài khoản chưa liên kết tài xế");
  const trip = await Trip.findOne({ _id: req.params.id, DriverID: driver._id });
  if (!trip) throw new ApiError(404, "Trip not found");
  if ([TripStatus.COMPLETED, TripStatus.CANCELLED].includes(trip.Status)) throw new ApiError(409, "Chuyến đã kết thúc");
  return trip;
}

export async function confirmTrip(req, res) {
  const trip = await loadDriverTrip(req);
  if (trip.Status === TripStatus.ASSIGNED) {
    trip.Status = TripStatus.DRIVER_CONFIRMED;
    trip.ConfirmedAt = new Date();
    await trip.save();
  }
  res.json({ success: true, data: trip });
}

export async function startLoading(req, res) {
  const trip = await loadDriverTrip(req);
  if ([TripStatus.ASSIGNED, TripStatus.DRIVER_CONFIRMED].includes(trip.Status)) {
    trip.Status = TripStatus.LOADING;
    trip.LoadingStartedAt = new Date();
    await trip.save();
  }
  res.json({ success: true, data: trip });
}

export async function startTrip(req, res) {
  const trip = await loadDriverTrip(req);
  if (![...activeTripStatuses].includes(trip.Status)) {
    trip.Status = TripStatus.IN_PROGRESS;
    trip.StartedAt = new Date();
    await trip.save();
  }
  res.json({ success: true, data: trip });
}

export async function returnTrip(req, res) {
  const trip = await loadDriverTrip(req);
  if (!trip.Tasks.every((task) => doneStatuses.includes(task.Status))) throw new ApiError(409, "Còn điểm giao chưa xử lý");
  trip.Status = TripStatus.RETURNING;
  await trip.save();
  res.json({ success: true, data: trip });
}

export async function updateTask(req, res) {
  const trip = await loadDriverTrip(req);
  const stopIndex = Number(req.params.stopIndex);
  const task = trip.Tasks.find((item) => item.StopIndex === stopIndex);
  if (!task) throw new ApiError(404, "Task not found");
  if (doneStatuses.includes(task.Status)) throw new ApiError(409, "Task already closed");

  if (req.params.action === "en-route") {
    task.Status = TripTaskStatus.EN_ROUTE;
  } else if (req.params.action === "arrive") {
    task.Status = TripTaskStatus.ARRIVED;
    task.ArrivedAt = new Date();
  } else if (req.params.action === "complete") {
    task.Status = TripTaskStatus.COMPLETED;
    task.CompletedAt = new Date();
    task.DriverNote = req.body?.note ?? task.DriverNote;
    task.CashCollected = Number(req.body?.cashCollected ?? task.CODAmount ?? 0);
    task.PodImages = Array.isArray(req.body?.podImages) ? req.body.podImages : task.PodImages;
    task.SignatureImage = req.body?.signatureImage ?? task.SignatureImage;
    await SalesOrder.updateMany({ _id: { $in: task.OrderIDs ?? [] } }, { $set: { OrderStatus: OrderStatus.DELIVERED } });
  } else if (req.params.action === "fail") {
    task.Status = TripTaskStatus.FAILED;
    task.FailedAt = new Date();
    task.FailureReason = req.body?.reason ?? "OTHER";
    task.DriverNote = req.body?.note ?? "";
  } else {
    throw new ApiError(400, "Action không hợp lệ");
  }

  trip.CurrentTaskIndex = trip.Tasks.find((item) => !doneStatuses.includes(item.Status))?.StopIndex ?? trip.CurrentTaskIndex;
  trip.TotalCODCollected = trip.Tasks.reduce((sum, item) => sum + Number(item.CashCollected || 0), 0);
  const status = nextTripStatus(trip.Tasks);
  if (status) {
    trip.Status = status;
    if (status === TripStatus.COMPLETED) trip.CompletedAt = new Date();
  }
  await trip.save();
  res.json({ success: true, data: trip });
}

export async function updateLegacyStopStatus(req, res) {
  const status = req.body?.status;
  const action =
    status === "IN_PROGRESS" ? "en-route" :
    status === "EN_ROUTE" ? "en-route" :
    status === "ARRIVED" ? "arrive" :
    status === "FAILED" ? "fail" :
    "complete";
  req.params.action = action;
  req.body = {
    ...req.body,
    reason: req.body?.reason ?? req.body?.FailureReason ?? "Khác",
    podImages: req.body?.podImages ?? req.body?.lastResponse?.entities?.filter((e) => e.type === "PHOTO").flatMap((e) => e.data?.map((d) => d.value) ?? []),
    signatureImage: req.body?.signatureImage ?? req.body?.lastResponse?.entities?.find((e) => e.type === "SIGNATURE")?.data?.[0]?.value ?? ""
  };
  return updateTask(req, res);
}

export async function finishTrip(req, res) {
  const trip = await loadDriverTrip(req);
  if (!trip.Tasks.every((task) => doneStatuses.includes(task.Status))) throw new ApiError(409, "Còn điểm giao chưa xử lý");
  trip.Status = TripStatus.COMPLETED;
  trip.CompletedAt = trip.CompletedAt ?? new Date();
  await trip.save();
  res.json({ success: true, data: trip });
}

export async function postGps(req, res) {
  const trip = await loadDriverTrip(req);
  const latitude = Number(req.body?.latitude);
  const longitude = Number(req.body?.longitude);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) throw new ApiError(400, "GPS không hợp lệ");
  const speed = Number(req.body?.speed ?? 0);
  trip.LastLatitude = latitude;
  trip.LastLongitude = longitude;
  trip.LastSpeed = Number.isFinite(speed) ? speed : 0;
  trip.LastGpsAt = new Date();
  await trip.save();
  await GpsLog.create({
    DriverID: trip.DriverID,
    RouteID: trip.DeliveryRouteID,
    OrganizationID: trip.OrganizationID,
    Latitude: latitude,
    Longitude: longitude,
    Speed: trip.LastSpeed,
    BatteryLevel: req.body?.batteryLevel
  });
  res.json({ success: true });
}
