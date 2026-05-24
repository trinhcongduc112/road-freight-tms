import "express-async-errors";
import cors from "cors";
import express from "express";
import helmet from "helmet";
import morgan from "morgan";
import swaggerUi from "swagger-ui-express";
import { env } from "./config/env.js";
import { connectDatabase } from "./config/db.js";
import { swaggerSpec } from "./config/swagger.js";
import { errorHandler } from "./middlewares/errorHandler.js";
import { perfMonitor } from "./middlewares/perfMonitor.js";
import { auditLogger } from "./middlewares/audit.js";
import { apiRouter } from "./routes/index.js";
import { logger } from "./utils/logger.js";
import { initSocket } from "./socket.js";
import { startTrafficFactorJob } from "./jobs/trafficFactorJob.js";
import http from "http";

async function bootstrap() {
  await connectDatabase();

  const app = express();
  app.set("trust proxy", 1);

  app.use(helmet());
  app.use(cors({ origin: env.frontendUrl, credentials: true }));
  app.use(express.json({ limit: "5mb" }));
  app.use(morgan(env.nodeEnv === "development" ? "dev" : "combined"));

  app.get("/health", (_req, res) => res.json({ ok: true, ts: Date.now() }));

  // OpenAPI / Swagger UI ở /api-docs
  app.use(
    "/api-docs",
    swaggerUi.serve,
    swaggerUi.setup(swaggerSpec, {
      customSiteTitle: "Road Freight TMS — API Docs",
      customCss: ".swagger-ui .topbar { display: none }"
    })
  );
  app.get("/api-docs.json", (_req, res) => res.json(swaggerSpec));

  app.use("/api", perfMonitor(), auditLogger(), apiRouter);

  app.use(errorHandler);

  const server = http.createServer(app);
  
  // Initialize Socket.IO with the same CORS configuration as Express
  initSocket(server, { origin: env.frontendUrl, credentials: true });

  server.listen(env.port, env.host, () => {
    // Log đúng host đang bind — tránh confuse khi đọc log production
    const displayHost = env.host === "0.0.0.0" ? "localhost" : env.host;
    logger.info(`Server listening on http://${displayHost}:${env.port} (bound to ${env.host}, env=${env.nodeEnv})`);
  });

  /* Background job: seed traffic factor defaults + recompute hằng ngày từ Trip history. */
  startTrafficFactorJob();
}

bootstrap().catch((err) => {
  logger.error("Failed to bootstrap:", err);
  process.exit(1);
});
