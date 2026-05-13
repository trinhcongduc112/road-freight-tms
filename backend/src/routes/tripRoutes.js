import { Router } from "express";
import { Actions, Modules, p } from "../config/permissions.js";
import * as ctrl from "../controllers/tripController.js";
import { authenticate } from "../middlewares/auth.js";
import { attachOrgScope } from "../middlewares/dac.js";
import { requirePermission } from "../middlewares/rbac.js";
import { asyncHandler } from "../utils/asyncHandler.js";

export const tripRouter = Router();

tripRouter.use(authenticate, attachOrgScope);

tripRouter.get("/", requirePermission(p(Modules.TRIP, Actions.READ)), asyncHandler(ctrl.listTrips));
tripRouter.get("/:id", requirePermission(p(Modules.TRIP, Actions.READ)), asyncHandler(ctrl.getTrip));
tripRouter.post("/sync-plan/:planId", requirePermission(p(Modules.TRIP, Actions.UPDATE)), asyncHandler(ctrl.syncPlanTrips));
