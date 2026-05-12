import { Router } from "express";
import { authenticate } from "../middlewares/auth.js";
import { attachOrgScope } from "../middlewares/dac.js";
import { requirePermission } from "../middlewares/rbac.js";
import { Modules, Actions, p } from "../config/permissions.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import * as ctrl from "../controllers/roleGroupController.js";

export const roleGroupRouter = Router();

roleGroupRouter.use(authenticate, attachOrgScope);

roleGroupRouter.get("/catalog", asyncHandler(ctrl.listPermissionCatalog));
roleGroupRouter.get("/", asyncHandler(ctrl.listRoleGroups));
roleGroupRouter.post(
  "/",
  requirePermission(p(Modules.ROLE, Actions.CREATE)),
  asyncHandler(ctrl.createRoleGroup)
);
roleGroupRouter.post(
  "/import",
  requirePermission(p(Modules.ROLE, Actions.CREATE)),
  asyncHandler(ctrl.importRoleGroups)
);
roleGroupRouter.put(
  "/:id",
  requirePermission(p(Modules.ROLE, Actions.UPDATE)),
  asyncHandler(ctrl.updateRoleGroup)
);
roleGroupRouter.delete(
  "/:id",
  requirePermission(p(Modules.ROLE, Actions.DELETE)),
  asyncHandler(ctrl.deleteRoleGroup)
);
