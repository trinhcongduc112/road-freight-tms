import { Router } from "express";
import { authenticate } from "../middlewares/auth.js";
import { attachOrgScope } from "../middlewares/dac.js";
import { requirePermission } from "../middlewares/rbac.js";
import { Modules, Actions, p } from "../config/permissions.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import * as ctrl from "../controllers/userController.js";

export const userRouter = Router();

userRouter.use(authenticate, attachOrgScope);

userRouter.get("/", asyncHandler(ctrl.listUsers));

userRouter.post(
  "/",
  requirePermission(p(Modules.USER, Actions.CREATE)),
  asyncHandler(ctrl.createUser)
);
userRouter.post(
  "/import",
  requirePermission(p(Modules.USER, Actions.CREATE)),
  asyncHandler(ctrl.importUsers)
);
userRouter.post(
  "/invite",
  requirePermission(p(Modules.USER, Actions.CREATE)),
  asyncHandler(ctrl.inviteUser)
);
userRouter.post(
  "/:id/resend-invitation",
  requirePermission(p(Modules.USER, Actions.UPDATE)),
  asyncHandler(ctrl.resendInvitation)
);

userRouter.put(
  "/:id",
  requirePermission(p(Modules.USER, Actions.UPDATE)),
  asyncHandler(ctrl.updateUser)
);
userRouter.delete(
  "/:id",
  requirePermission(p(Modules.USER, Actions.DELETE)),
  asyncHandler(ctrl.deleteUser)
);
