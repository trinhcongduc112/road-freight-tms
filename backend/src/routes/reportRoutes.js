import { Router } from "express";
import { authenticate } from "../middlewares/auth.js";
import { attachOrgScope } from "../middlewares/dac.js";
import { requirePermission } from "../middlewares/rbac.js";
import { Modules, Actions, p } from "../config/permissions.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import * as ctrl from "../controllers/reportController.js";

export const reportRouter = Router();

reportRouter.use(authenticate, attachOrgScope);

reportRouter.get("/summary", requirePermission(p(Modules.ORDER, Actions.READ)), asyncHandler(ctrl.summary));
