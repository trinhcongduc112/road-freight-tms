import { Server } from "socket.io";
import jwt from "jsonwebtoken";
import { env } from "./config/env.js";
import { User, UserStatus } from "./models/User.js";
import { Driver } from "./models/Driver.js";
import { GpsLog } from "./models/GpsLog.js";
import { Trip, TripStatus } from "./models/Trip.js";
import { TripIncident, IncidentType, IncidentSeverity } from "./models/TripIncident.js";
import { logger } from "./utils/logger.js";

let io;

/* ── Route-deviation detection ────────────────────────────────────────────
   For each active trip we keep an in-memory counter of consecutive GPS pings
   that landed farther than DEVIATION_THRESHOLD_M from the nearest planned
   stop / depot. After DEVIATION_COUNT_TRIGGER such pings we auto-emit a
   DEVIATION incident so dispatchers see it in the monitoring feed.

   This is a coarse "are we even near the route?" check rather than a full
   polyline-distance computation — good enough as an early warning without
   blocking the GPS write path. */
const DEVIATION_THRESHOLD_M = 800;       // > 800m from nearest planned point
const DEVIATION_COUNT_TRIGGER = 4;       // 4 consecutive pings ≈ 40-60s of drift
const DEVIATION_COOLDOWN_MS  = 5 * 60 * 1000; // don't spam more than 1 / 5min per trip

const deviationState = new Map();  // tripId → { count, lastIncidentAt }

function haversineMeters(lat1, lng1, lat2, lng2) {
  const R = 6371000;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2
          + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180)
          * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

function minDistanceToTripPoints(trip, lat, lng) {
  const points = [];
  if (trip.DepotLatitude != null && trip.DepotLongitude != null) {
    points.push([trip.DepotLatitude, trip.DepotLongitude]);
  }
  for (const t of trip.Tasks ?? []) {
    if (t.Latitude != null && t.Longitude != null) points.push([t.Latitude, t.Longitude]);
  }
  if (!points.length) return 0;
  let min = Infinity;
  for (const [pLat, pLng] of points) {
    const d = haversineMeters(lat, lng, pLat, pLng);
    if (d < min) min = d;
  }
  return min;
}

export async function checkDeviation(userId, lat, lng) {
  /* Only check for drivers currently on an in-progress trip */
  const trip = await Trip.findOne({
    DriverUserID: userId,
    Status: { $in: [TripStatus.IN_PROGRESS, TripStatus.RETURNING] }
  }).lean();
  if (!trip) return;

  const dist = minDistanceToTripPoints(trip, lat, lng);
  const tripKey = String(trip._id);
  const state = deviationState.get(tripKey) ?? { count: 0, lastIncidentAt: 0 };

  if (dist > DEVIATION_THRESHOLD_M) {
    state.count += 1;
    if (state.count >= DEVIATION_COUNT_TRIGGER
        && Date.now() - state.lastIncidentAt > DEVIATION_COOLDOWN_MS) {
      try {
        const incident = await TripIncident.create({
          OrganizationID: trip.OrganizationID,
          TripID:         trip._id,
          TripCode:       trip.TripCode,
          DriverUserID:   userId,
          DriverName:     trip.DriverName ?? "",
          VehicleCode:    trip.VehicleCode,
          Type:           IncidentType.DEVIATION,
          Severity:       IncidentSeverity.MEDIUM,
          Description:    `Xe đi chệch lộ trình ~${Math.round(dist)}m so với điểm gần nhất`,
          Latitude:       lat,
          Longitude:      lng,
          DeviationDistance: Math.round(dist),
          DeviationCount:    state.count
        });
        io?.to(`org_${trip.OrganizationID.toString()}`).emit("trip:incident", incident);
        state.lastIncidentAt = Date.now();
        state.count = 0;
      } catch (err) {
        logger.error("Failed to create deviation incident", err);
      }
    }
  } else {
    state.count = 0;
  }
  deviationState.set(tripKey, state);
}

export function initSocket(server, corsOptions) {
  io = new Server(server, { cors: corsOptions });

  // Socket.IO authentication middleware
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth.token || socket.handshake.query.token;
      if (!token) {
        return next(new Error("Authentication error: Missing token"));
      }

      const payload = jwt.verify(token, env.jwtSecret);
      const user = await User.findById(payload.sub).lean();
      
      if (!user || !user.IsActive) return next(new Error("Authentication error: Invalid user"));
      if (user.Status !== UserStatus.ACTIVE) return next(new Error("Authentication error: User not active"));

      socket.user = user;
      socket.join(`user_${user._id.toString()}`);

      // Join rooms based on OrganizationIDs to receive targeted broadcasts
      const orgIds = user.OrganizationIDs || [];
      orgIds.forEach(orgId => socket.join(`org_${orgId.toString()}`));

      next();
    } catch (err) {
      next(new Error("Authentication error: Invalid token"));
    }
  });

  io.on("connection", (socket) => {
    logger.info(`Socket connected: ${socket.id} (User: ${socket.user.UserName})`);

    socket.on("disconnect", () => {
      logger.info(`Socket disconnected: ${socket.id}`);
    });

    // Receive location update from mobile or simulator
    socket.on("driver_location_update", async (data) => {
      // data expected: { driverId, routeId, lat, lng, speed, ... }
      if (!data.lat || !data.lng) return;

      const orgIds = socket.user.OrganizationIDs || [];
      
      try {
        const driver = await Driver.findOne({ LinkedUserID: socket.user._id, Status: "Active" }).lean();
        if (!driver) return;
        // Lưu lịch sử toạ độ vào Database (giống Abivin LocationHistories)
        await GpsLog.create({
          DriverID: driver._id,
          RouteID: data.routeId || null,
          OrganizationID: orgIds[0] || null,
          Latitude: data.lat,
          Longitude: data.lng,
          Speed: data.speed || 0,
          Timestamp: new Date()
        });
      } catch (err) {
        logger.error("Failed to save GPS Log", err);
      }

      // Broadcast to all admins/dispatchers in the same organization(s)
      orgIds.forEach(orgId => {
        io.to(`org_${orgId.toString()}`).emit("location_changed", {
          driverId: driver._id,
          ...data,
          updatedAt: new Date()
        });
      });

      /* Fire-and-forget deviation check (doesn't block broadcast) */
      checkDeviation(socket.user._id, data.lat, data.lng).catch((err) =>
        logger.error("Deviation check failed", err)
      );
    });
  });

  return io;
}

export function getIO() {
  if (!io) {
    throw new Error("Socket.IO has not been initialized yet");
  }
  return io;
}
