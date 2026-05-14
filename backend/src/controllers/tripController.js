import { DeliveryRoute } from "../models/DeliveryRoute.js";
import { Driver } from "../models/Driver.js";
import { GpsLog } from "../models/GpsLog.js";
import { OrderStatus, SalesOrder } from "../models/SalesOrder.js";
import { Trip, TripStatus, TripTaskStatus } from "../models/Trip.js";
import { TripIncident, IncidentType, IncidentSeverity, IncidentStatus } from "../models/TripIncident.js";
import { assertOrgInScope, scopeFilter } from "../middlewares/dac.js";
import { ApiError } from "../utils/apiError.js";
import { ensureTripForRouteId, ensureTripsForPlanId } from "../services/tripService.js";
import { getIO, checkDeviation } from "../socket.js";

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

/** Helper — broadcast trip status update đến dispatcher trong org */
function emitTripUpdate(trip) {
  try {
    getIO()?.to(`org_${trip.OrganizationID.toString()}`).emit("trip:status", {
      tripId: String(trip._id), status: trip.Status,
      vehicleCode: trip.VehicleCode, driverName: trip.DriverName,
      updatedAt: new Date()
    });
  } catch { /* socket not initialised */ }
}

function takePhotos(body, max = 6) {
  if (!Array.isArray(body?.photos)) return [];
  return body.photos.filter((p) => typeof p === "string" && p.length < 2_000_000).slice(0, max);
}

export async function confirmTrip(req, res) {
  const trip = await loadDriverTrip(req);
  if (trip.Status === TripStatus.ASSIGNED) {
    trip.Status = TripStatus.DRIVER_CONFIRMED;
    trip.ConfirmedAt = new Date();
    trip.ConfirmPhotos = takePhotos(req.body, 2);
    await trip.save();
    emitTripUpdate(trip);
  }
  res.json({ success: true, data: trip });
}

export async function startLoading(req, res) {
  const trip = await loadDriverTrip(req);
  if ([TripStatus.ASSIGNED, TripStatus.DRIVER_CONFIRMED].includes(trip.Status)) {
    trip.Status = TripStatus.LOADING;
    trip.LoadingStartedAt = new Date();
    trip.LoadingPhotos = takePhotos(req.body);
    trip.LoadingNote = String(req.body?.note ?? "").trim().slice(0, 500);
    await trip.save();
    emitTripUpdate(trip);
  }
  res.json({ success: true, data: trip });
}

export async function startTrip(req, res) {
  const trip = await loadDriverTrip(req);
  if (![...activeTripStatuses].includes(trip.Status)) {
    trip.Status = TripStatus.IN_PROGRESS;
    trip.StartedAt = new Date();
    trip.StartPhotos = takePhotos(req.body);
    if (Number.isFinite(Number(req.body?.odometer))) trip.StartOdometer = Number(req.body.odometer);
    await trip.save();
    emitTripUpdate(trip);
  }
  res.json({ success: true, data: trip });
}

export async function returnTrip(req, res) {
  const trip = await loadDriverTrip(req);
  if (!trip.Tasks.every((task) => doneStatuses.includes(task.Status))) throw new ApiError(409, "Còn điểm giao chưa xử lý");
  trip.Status = TripStatus.RETURNING;
  trip.ReturnedAt = new Date();
  trip.ReturnPhotos = takePhotos(req.body);
  if (Number.isFinite(Number(req.body?.odometer))) trip.ReturnOdometer = Number(req.body.odometer);
  await trip.save();
  emitTripUpdate(trip);
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

    /* Phát hiện "giao hàng sai tọa độ" — nếu GPS hiện tại của xe cách điểm
       dừng kế hoạch quá GEOFENCE_M thì tự tạo cảnh báo gửi dispatcher. */
    const GEOFENCE_M = 300;
    if (Number.isFinite(Number(task.Latitude)) && Number.isFinite(Number(task.Longitude))
        && Number.isFinite(Number(trip.LastLatitude)) && Number.isFinite(Number(trip.LastLongitude))) {
      const R = 6371000;
      const dLat = (trip.LastLatitude - task.Latitude) * Math.PI / 180;
      const dLng = (trip.LastLongitude - task.Longitude) * Math.PI / 180;
      const a = Math.sin(dLat / 2) ** 2
              + Math.cos(task.Latitude * Math.PI / 180) * Math.cos(trip.LastLatitude * Math.PI / 180)
              * Math.sin(dLng / 2) ** 2;
      const distM = Math.round(2 * R * Math.asin(Math.sqrt(a)));
      if (distM > GEOFENCE_M) {
        try {
          const incident = await TripIncident.create({
            OrganizationID: trip.OrganizationID,
            TripID:         trip._id,
            TripCode:       trip.TripCode,
            DriverUserID:   req.user._id,
            DriverName:     trip.DriverName ?? req.user.FullName ?? "",
            VehicleCode:    trip.VehicleCode,
            Type:           IncidentType.OTHER,
            Severity:       distM > 1000 ? IncidentSeverity.HIGH : IncidentSeverity.MEDIUM,
            Description:    `Giao hàng sai tọa độ — xác nhận ePOD ở vị trí lệch ${distM}m so với địa chỉ khách ${task.CustomerName}`,
            Latitude:       trip.LastLatitude,
            Longitude:      trip.LastLongitude,
            DeviationDistance: distM
          });
          getIO()?.to(`org_${trip.OrganizationID.toString()}`).emit("trip:incident", incident);
        } catch { /* not critical */ }
      }
    }
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
  emitTripUpdate(trip);
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
  trip.FinishPhotos = takePhotos(req.body);
  trip.FinishNote = String(req.body?.note ?? "").trim().slice(0, 500);
  await trip.save();
  emitTripUpdate(trip);
  res.json({ success: true, data: trip });
}

/** POST /api/driver/trips/:id/incidents — tài xế báo sự cố trên chuyến */
export async function reportIncident(req, res) {
  const trip = await loadDriverTrip(req);
  const { type, severity, description, latitude, longitude, photos } = req.body ?? {};
  const incidentType = Object.values(IncidentType).includes(type) ? type : IncidentType.OTHER;
  const incidentSeverity = Object.values(IncidentSeverity).includes(severity) ? severity : IncidentSeverity.MEDIUM;

  const incident = await TripIncident.create({
    OrganizationID: trip.OrganizationID,
    TripID:         trip._id,
    TripCode:       trip.TripCode,
    DriverUserID:   req.user._id,
    DriverName:     trip.DriverName ?? req.user.FullName ?? "",
    VehicleCode:    trip.VehicleCode,
    Type:           incidentType,
    Severity:       incidentSeverity,
    Description:    String(description ?? "").trim().slice(0, 1000),
    Latitude:       Number.isFinite(Number(latitude))  ? Number(latitude)  : trip.LastLatitude  ?? null,
    Longitude:      Number.isFinite(Number(longitude)) ? Number(longitude) : trip.LastLongitude ?? null,
    Photos:         Array.isArray(photos) ? photos.slice(0, 6) : []
  });

  /* Realtime push to dispatchers in this org */
  try {
    getIO().to(`org_${trip.OrganizationID.toString()}`).emit("trip:incident", incident);
  } catch { /* socket not initialised in tests */ }

  res.status(201).json({ success: true, data: incident });
}

/** GET /api/trips/incidents — dispatcher feed (org-scoped) */
export async function listIncidents(req, res) {
  const filter = scopeFilter(req.orgScope);
  if (req.query.status) filter.Status = req.query.status;
  if (req.query.tripId) filter.TripID = req.query.tripId;
  const incidents = await TripIncident.find(filter).sort({ ReportedAt: -1 }).limit(200).lean();
  res.json({ success: true, data: incidents });
}

/** PATCH /api/trips/incidents/:id — dispatcher acknowledges / resolves / dismisses */
export async function updateIncident(req, res) {
  const incident = await TripIncident.findById(req.params.id);
  if (!incident) throw new ApiError(404, "Incident not found");
  assertOrgInScope(req.orgScope, incident.OrganizationID);

  const { status, dispatcherNote } = req.body ?? {};
  if (status && Object.values(IncidentStatus).includes(status)) {
    incident.Status = status;
    if (status === IncidentStatus.ACKNOWLEDGED) {
      incident.AcknowledgedAt = new Date();
      incident.AcknowledgedBy = req.user._id;
    }
    if (status === IncidentStatus.RESOLVED || status === IncidentStatus.DISMISSED) {
      incident.ResolvedAt = new Date();
      incident.ResolvedBy = req.user._id;
    }
  }
  if (typeof dispatcherNote === "string") incident.DispatcherNote = dispatcherNote.slice(0, 500);
  await incident.save();

  try {
    getIO().to(`org_${incident.OrganizationID.toString()}`).emit("trip:incident:update", incident);
  } catch { /* */ }

  res.json({ success: true, data: incident });
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
  /* Broadcast realtime location to org room + run deviation check */
  try {
    getIO().to(`org_${trip.OrganizationID.toString()}`).emit("location_changed", {
      tripId: String(trip._id),
      driverId: trip.DriverID ? String(trip.DriverID) : null,
      lat: latitude,
      lng: longitude,
      speed: trip.LastSpeed,
      updatedAt: new Date()
    });
  } catch { /* socket not ready */ }
  checkDeviation(req.user._id, latitude, longitude).catch(() => {});

  res.json({ success: true });
}
