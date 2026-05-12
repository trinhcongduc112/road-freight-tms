import { Router } from "express";
import { getMyRoutes, getRouteDetail, updateStopStatus } from "../controllers/driverController.js";
import { authenticate } from "../middlewares/auth.js";

export const driverRouter = Router();

// Tất cả API của driver đều cần xác thực
driverRouter.use(authenticate);

// Các endpoint dành cho Mobile App
driverRouter.get("/routes", getMyRoutes);
driverRouter.get("/routes/:id", getRouteDetail);
driverRouter.post("/routes/:id/stops/:stopIndex/status", updateStopStatus);
