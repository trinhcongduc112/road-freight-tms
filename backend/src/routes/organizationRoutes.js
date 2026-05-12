import { Router } from "express";
import { authenticate } from "../middlewares/auth.js";
import { attachOrgScope } from "../middlewares/dac.js";
import { requirePermission } from "../middlewares/rbac.js";
import { Modules, Actions, p } from "../config/permissions.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import * as ctrl from "../controllers/organizationController.js";

export const organizationRouter = Router();

organizationRouter.use(authenticate, attachOrgScope);

// GET endpoints không cần `organization:read` riêng — DAC scope đã giới hạn theo
// User.OrganizationIDs + SeeChildren. Mọi user đăng nhập đều có quyền xem
// danh sách Org thuộc phạm vi của mình (convention từ Abivin).
organizationRouter.get("/", asyncHandler(ctrl.listOrganizations));
organizationRouter.get("/tree", asyncHandler(ctrl.getTree));
organizationRouter.get("/:id", asyncHandler(ctrl.getOrganization));

organizationRouter.post(
  "/",
  requirePermission(p(Modules.ORGANIZATION, Actions.CREATE)),
  asyncHandler(ctrl.createOrganization)
);
organizationRouter.post(
  "/import",
  requirePermission(p(Modules.ORGANIZATION, Actions.CREATE)),
  asyncHandler(ctrl.importOrganizations)
);
organizationRouter.put(
  "/:id",
  requirePermission(p(Modules.ORGANIZATION, Actions.UPDATE)),
  asyncHandler(ctrl.updateOrganization)
);
organizationRouter.delete(
  "/:id",
  requirePermission(p(Modules.ORGANIZATION, Actions.DELETE)),
  asyncHandler(ctrl.deleteOrganization)
);
