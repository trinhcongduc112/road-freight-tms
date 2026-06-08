// Sentry phải init TRƯỚC mọi import khác để hook được error xảy ra trong module loading
import { initSentry, sentryErrorHandler } from "./config/sentry.js";
initSentry();

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
import { globalRateLimiter } from "./middlewares/rateLimit.js";
import { apiRouter } from "./routes/index.js";
import { logger } from "./utils/logger.js";
import { initSocket } from "./socket.js";
import { startTrafficFactorJob } from "./jobs/trafficFactorJob.js";
import http from "http";

async function bootstrap() {
  await connectDatabase();

  const app = express();
  // Trust proxy: whitelist các dải IP nội bộ (loopback + LAN + docker bridge).
  // "uniquelocal" cover 10.0.0.0/8 + 172.16.0.0/12 + 192.168.0.0/16 — đúng dải
  // docker-compose hay nginx host dùng. Khi đó req.ip lấy đúng IP user thật từ
  // X-Forwarded-For (nginx đã set), thay vì trả về 172.18.0.1 (docker gateway).
  app.set("trust proxy", ["loopback", "linklocal", "uniquelocal"]);

  app.use(helmet());
  /* CORS đa origin:
     - PROD: strict whitelist từ CORS_ORIGINS (CSV của các subdomain).
     - DEV: ngoài whitelist, tự động cho phép localhost / 127.0.0.1 / LAN IPs để
       không phải config gì khi test web/mobile trên cùng máy.
     - Request không có Origin (mobile native, curl, server-to-server) luôn pass. */
  const isDev = env.nodeEnv !== "production";
  const LAN_IP_RE = /^https?:\/\/(localhost|127\.0\.0\.1|0\.0\.0\.0|192\.168\.\d+\.\d+|10\.\d+\.\d+\.\d+|172\.(1[6-9]|2\d|3[01])\.\d+\.\d+)(:\d+)?$/;
  const corsOrigin = (origin, callback) => {
    if (!origin) return callback(null, true);
    if (env.corsOrigins.includes("*")) return callback(null, true);
    if (env.corsOrigins.includes(origin)) return callback(null, true);
    if (isDev && LAN_IP_RE.test(origin)) return callback(null, true);
    return callback(new Error(`CORS blocked: ${origin}`));
  };
  app.use(cors({ origin: corsOrigin, credentials: true }));
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

  app.use("/api", globalRateLimiter, perfMonitor(), auditLogger(), apiRouter);

  // Sentry error handler PHẢI đặt trước errorHandler chính
  app.use(sentryErrorHandler());
  app.use(errorHandler);

  const server = http.createServer(app);
  
  // Initialize Socket.IO with the same CORS configuration as Express
  /* Socket.IO dùng cùng policy: strict prod, lenient dev. */
  initSocket(server, { origin: corsOrigin, credentials: true });

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
