import { Router } from "express";
import { Actions, Modules, p } from "../config/permissions.js";
import * as ctrl from "../controllers/tripController.js";
import * as messageCtrl from "../controllers/driverMessageController.js";
import { authenticate } from "../middlewares/auth.js";
import { attachOrgScope } from "../middlewares/dac.js";
import { requirePermission } from "../middlewares/rbac.js";
import { asyncHandler } from "../utils/asyncHandler.js";

export const tripRouter = Router();

tripRouter.use(authenticate, attachOrgScope);

tripRouter.get("/", requirePermission(p(Modules.TRIP, Actions.READ)), asyncHandler(ctrl.listTrips));
/* Incidents must come before /:id so the literal path wins */
tripRouter.get("/incidents", requirePermission(p(Modules.TRIP, Actions.READ)), asyncHandler(ctrl.listIncidents));
tripRouter.patch("/incidents/:id", requirePermission(p(Modules.TRIP, Actions.UPDATE)), asyncHandler(ctrl.updateIncident));
tripRouter.get("/messages/unread-counts", requirePermission(p(Modules.TRIP, Actions.READ)), asyncHandler(messageCtrl.unreadCounts));
tripRouter.get("/:id", requirePermission(p(Modules.TRIP, Actions.READ)), asyncHandler(ctrl.getTrip));
tripRouter.get("/:id/messages", requirePermission(p(Modules.TRIP, Actions.READ)), asyncHandler(messageCtrl.listTripMessages));
tripRouter.post("/:id/messages", requirePermission(p(Modules.TRIP, Actions.UPDATE)), asyncHandler(messageCtrl.sendTripMessage));
tripRouter.post("/sync-plan/:planId", requirePermission(p(Modules.TRIP, Actions.UPDATE)), asyncHandler(ctrl.syncPlanTrips));
