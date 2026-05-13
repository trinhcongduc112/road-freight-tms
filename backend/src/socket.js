import { Server } from "socket.io";
import jwt from "jsonwebtoken";
import { env } from "./config/env.js";
import { User, UserStatus } from "./models/User.js";
import { Driver } from "./models/Driver.js";
import { GpsLog } from "./models/GpsLog.js";
import { logger } from "./utils/logger.js";

let io;

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
