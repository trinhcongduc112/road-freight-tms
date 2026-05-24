import { Router } from "express";
import * as ctrl from "../controllers/tripController.js";
import * as messageCtrl from "../controllers/driverMessageController.js";
import * as notifCtrl from "../controllers/driverNotificationController.js";
import * as maintCtrl from "../controllers/driverMaintenanceController.js";
import { authenticate } from "../middlewares/auth.js";
import { asyncHandler } from "../utils/asyncHandler.js";

export const driverRouter = Router();

driverRouter.use(authenticate);

// Thông báo trong app (gán bảo dưỡng, chuyến mới...)
driverRouter.get("/notifications", asyncHandler(notifCtrl.listMyNotifications));
driverRouter.get("/notifications/unread-count", asyncHandler(notifCtrl.unreadCount));
driverRouter.patch("/notifications/:id/read", asyncHandler(notifCtrl.markRead));
driverRouter.patch("/notifications/mark-all-read", asyncHandler(notifCtrl.markAllRead));

// Bảo dưỡng xe được giao
driverRouter.get("/maintenance", asyncHandler(maintCtrl.listMyMaintenance));
driverRouter.get("/maintenance/:id", asyncHandler(maintCtrl.getMyMaintenance));
driverRouter.post("/maintenance/:id/acknowledge", asyncHandler(maintCtrl.acknowledgeMaintenance));
driverRouter.post("/maintenance/:id/complete", asyncHandler(maintCtrl.completeMaintenance));

driverRouter.get("/trips", asyncHandler(ctrl.getMyTrips));
driverRouter.get("/messages", asyncHandler(messageCtrl.listMyMessages));
driverRouter.get("/trips/:id", asyncHandler(ctrl.getMyTrip));
driverRouter.get("/trips/:id/messages", asyncHandler(messageCtrl.listMyTripMessages));
driverRouter.post("/trips/:id/messages", asyncHandler(messageCtrl.sendMyTripMessage));
driverRouter.post("/trips/:id/confirm", asyncHandler(ctrl.confirmTrip));
driverRouter.post("/trips/:id/loading", asyncHandler(ctrl.startLoading));
driverRouter.post("/trips/:id/start", asyncHandler(ctrl.startTrip));
driverRouter.post("/trips/:id/return", asyncHandler(ctrl.returnTrip));
driverRouter.post("/trips/:id/tasks/:stopIndex/explain-deviation", asyncHandler(ctrl.explainStopDeviation));
driverRouter.post("/trips/:id/tasks/:stopIndex/:action", asyncHandler(ctrl.updateTask));
driverRouter.post("/trips/:id/finish", asyncHandler(ctrl.finishTrip));
driverRouter.post("/trips/:id/gps", asyncHandler(ctrl.postGps));
driverRouter.post("/trips/:id/incidents", asyncHandler(ctrl.reportIncident));

driverRouter.get("/routes", asyncHandler(ctrl.getMyTrips));
driverRouter.get("/routes/:id", asyncHandler(ctrl.getMyTrip));
driverRouter.post("/routes/:id/stops/:stopIndex/status", asyncHandler(ctrl.updateLegacyStopStatus));
