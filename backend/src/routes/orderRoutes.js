import { Router } from "express";
import multer from "multer";
import { authenticate } from "../middlewares/auth.js";
import { attachOrgScope } from "../middlewares/dac.js";
import { requirePermission } from "../middlewares/rbac.js";
import { Modules, Actions, p } from "../config/permissions.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import * as ctrl from "../controllers/orderController.js";

export const orderRouter = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

orderRouter.use(authenticate, attachOrgScope);

orderRouter.get("/", requirePermission(p(Modules.ORDER, Actions.READ)), asyncHandler(ctrl.listOrders));
orderRouter.get("/:id", requirePermission(p(Modules.ORDER, Actions.READ)), asyncHandler(ctrl.getOrder));

orderRouter.post(
  "/create",
  requirePermission(p(Modules.ORDER, Actions.CREATE)),
  asyncHandler(ctrl.createOrder)
);
orderRouter.put(
  "/:id",
  requirePermission(p(Modules.ORDER, Actions.UPDATE)),
  asyncHandler(ctrl.updateOrder)
);
orderRouter.delete(
  "/:id",
  requirePermission(p(Modules.ORDER, Actions.DELETE)),
  asyncHandler(ctrl.deleteOrder)
);
orderRouter.post(
  "/upload",
  requirePermission(p(Modules.ORDER, Actions.IMPORT)),
  upload.single("file"),
  asyncHandler(ctrl.uploadOrders)
);
orderRouter.post(
  "/mobile/create",
  requirePermission(p(Modules.ORDER, Actions.CREATE)),
  asyncHandler(ctrl.createOrder)
);
orderRouter.post(
  "/change/status",
  requirePermission(p(Modules.ORDER, Actions.UPDATE)),
  asyncHandler(ctrl.changeOrderStatus)
);
orderRouter.post(
  "/change/planning-status",
  requirePermission(p(Modules.ORDER, Actions.UPDATE)),
  asyncHandler(ctrl.changePlanningStatus)
);
orderRouter.post(
  "/change/approval-status",
  requirePermission(p(Modules.ORDER, Actions.UPDATE)),
  asyncHandler(ctrl.approveOrder)
);
orderRouter.post(
  "/allocate",
  requirePermission(p(Modules.ORDER, Actions.UPDATE)),
  asyncHandler(ctrl.allocateOrderToTrip)
);
orderRouter.get(
  "/:id/allocations",
  requirePermission(p(Modules.ORDER, Actions.READ)),
  asyncHandler(ctrl.listOrderAllocations)
);
