import { Router } from "express";
import * as ctrl from "../controllers/tripController.js";
import { authenticate } from "../middlewares/auth.js";
import { asyncHandler } from "../utils/asyncHandler.js";

export const driverRouter = Router();

driverRouter.use(authenticate);

driverRouter.get("/trips", asyncHandler(ctrl.getMyTrips));
driverRouter.get("/trips/:id", asyncHandler(ctrl.getMyTrip));
driverRouter.post("/trips/:id/confirm", asyncHandler(ctrl.confirmTrip));
driverRouter.post("/trips/:id/loading", asyncHandler(ctrl.startLoading));
driverRouter.post("/trips/:id/start", asyncHandler(ctrl.startTrip));
driverRouter.post("/trips/:id/return", asyncHandler(ctrl.returnTrip));
driverRouter.post("/trips/:id/tasks/:stopIndex/:action", asyncHandler(ctrl.updateTask));
driverRouter.post("/trips/:id/finish", asyncHandler(ctrl.finishTrip));
driverRouter.post("/trips/:id/gps", asyncHandler(ctrl.postGps));

driverRouter.get("/routes", asyncHandler(ctrl.getMyTrips));
driverRouter.get("/routes/:id", asyncHandler(ctrl.getMyTrip));
driverRouter.post("/routes/:id/stops/:stopIndex/status", asyncHandler(ctrl.updateLegacyStopStatus));
