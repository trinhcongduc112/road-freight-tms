import { Router } from "express";
import { authRouter } from "./authRoutes.js";
import { demoRouter } from "./demoRoutes.js";
import { masterDataRouter } from "./masterDataRoutes.js";
import { organizationRouter } from "./organizationRoutes.js";
import { orderRouter } from "./orderRoutes.js";
import { reportRouter } from "./reportRoutes.js";
import { roleGroupRouter } from "./roleGroupRoutes.js";
import { routePlanRouter } from "./routePlanRoutes.js";
import { supportRouter } from "./supportRoutes.js";
import { userRouter } from "./userRoutes.js";
import { driverRouter } from "./driverRoutes.js";
import { tripRouter } from "./tripRoutes.js";
import { contactRouter } from "./contactRoutes.js";
import { agentRouter } from "./agentRoutes.js";
import { auditRouter } from "./auditRoutes.js";
import { trackingRouter } from "./trackingRoutes.js";
import { maintenanceRouter } from "./maintenanceRoutes.js";
import { payrollRouter } from "./payrollRoutes.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { systemHealth, systemMetrics } from "../controllers/systemController.js";

export const apiRouter = Router();

apiRouter.use("/auth", authRouter);
apiRouter.use("/demo", demoRouter);
apiRouter.use("/organizations", organizationRouter);
apiRouter.use("/orders", orderRouter);
apiRouter.use("/role-groups", roleGroupRouter);
apiRouter.use("/users", userRouter);
apiRouter.use("/master-data", masterDataRouter);
apiRouter.use("/route-plans", routePlanRouter);
apiRouter.use("/reports", reportRouter);
apiRouter.use("/support", supportRouter);
apiRouter.use("/driver", driverRouter);
apiRouter.use("/trips", tripRouter);
apiRouter.use("/public", contactRouter);
apiRouter.use("/agent", agentRouter);
apiRouter.use("/audit-logs", auditRouter);
apiRouter.use("/track", trackingRouter);
apiRouter.use("/maintenance", maintenanceRouter);
apiRouter.use("/payroll", payrollRouter);

apiRouter.get("/system/health", asyncHandler(systemHealth));
apiRouter.get("/system/metrics", asyncHandler(systemMetrics));

apiRouter.get("/", (_req, res) => {
  res.json({
    name: "Road Freight TMS API",
    version: "0.2.0",
    sprint: "1 - Master Data + Order Lifecycle"
  });
});
