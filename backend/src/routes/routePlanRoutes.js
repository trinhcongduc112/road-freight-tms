import { Router } from "express";
import { authenticate } from "../middlewares/auth.js";
import { attachOrgScope } from "../middlewares/dac.js";
import { requirePermission, requireAnyPermission } from "../middlewares/rbac.js";
import { Modules, Actions, RoutePlanActions, p } from "../config/permissions.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import * as ctrl from "../controllers/routePlanController.js";

export const routePlanRouter = Router();

routePlanRouter.use(authenticate, attachOrgScope);

const READ  = p(Modules.ROUTE_PLAN, Actions.READ);
const WRITE = p(Modules.ROUTE_PLAN, Actions.UPDATE);
const LOCK  = p(Modules.ROUTE_PLAN, RoutePlanActions.LOCK);
const UNLOCK = p(Modules.ROUTE_PLAN, RoutePlanActions.UNLOCK);
const FINAL = p(Modules.ROUTE_PLAN, RoutePlanActions.FINALIZE);

/* ── Route Plans ── */
routePlanRouter.get("/unplanned-orders", requirePermission(READ), asyncHandler(ctrl.getUnplannedOrders));
routePlanRouter.get("/", requirePermission(READ), asyncHandler(ctrl.listRoutePlans));
routePlanRouter.get("/:id", requirePermission(READ), asyncHandler(ctrl.getRoutePlan));
routePlanRouter.post("/", requireAnyPermission(WRITE), asyncHandler(ctrl.createRoutePlan));
routePlanRouter.patch("/:id", requirePermission(WRITE), asyncHandler(ctrl.updateRoutePlan));
routePlanRouter.delete("/:id", requirePermission(WRITE), asyncHandler(ctrl.deleteRoutePlan));

/* ── Delivery Routes ── */
routePlanRouter.get("/:id/routes", requirePermission(READ), asyncHandler(ctrl.listRoutes));
routePlanRouter.post("/:id/routes", requirePermission(WRITE), asyncHandler(ctrl.addRoute));
routePlanRouter.delete("/:planId/routes/:routeId", requirePermission(WRITE), asyncHandler(ctrl.removeRoute));

/* ── Stop / Order assignment ── */
routePlanRouter.post("/:planId/routes/:routeId/stops", requirePermission(WRITE), asyncHandler(ctrl.addOrderToRoute));
routePlanRouter.delete("/:planId/routes/:routeId/orders/:orderId", requirePermission(WRITE), asyncHandler(ctrl.removeOrderFromRoute));

/* ── Move order between routes (with constraint validation) ── */
routePlanRouter.post("/:planId/move-order", requirePermission(WRITE), asyncHandler(ctrl.moveOrderBetweenRoutes));
routePlanRouter.post("/:planId/reorder-order", requirePermission(WRITE), asyncHandler(ctrl.reorderOrder));

/* ── Driver / 3PL service / cost assignment ── */
routePlanRouter.patch("/:planId/routes/:routeId/assignment", requirePermission(WRITE), asyncHandler(ctrl.assignRoute));

/* ── Lock / Unlock / Finalize ── */
routePlanRouter.post("/:planId/routes/:routeId/lock", requirePermission(LOCK), asyncHandler(ctrl.lockRoute));
routePlanRouter.post("/:planId/routes/:routeId/unlock", requirePermission(UNLOCK), asyncHandler(ctrl.unlockRoute));
routePlanRouter.post("/:planId/routes/:routeId/finalize", requirePermission(FINAL), asyncHandler(ctrl.finalizeRoute));

/* ── Optimize ── */
const OPTIMIZE = p(Modules.ROUTE_PLAN, RoutePlanActions.OPTIMIZE);
routePlanRouter.post("/:id/optimize", requirePermission(OPTIMIZE), asyncHandler(ctrl.optimizeRoutePlan));
routePlanRouter.post("/:id/benchmark", requirePermission(OPTIMIZE), asyncHandler(ctrl.benchmarkRoutePlan));
