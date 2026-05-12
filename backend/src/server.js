import "express-async-errors";
import cors from "cors";
import express from "express";
import helmet from "helmet";
import morgan from "morgan";
import { env } from "./config/env.js";
import { connectDatabase } from "./config/db.js";
import { errorHandler } from "./middlewares/errorHandler.js";
import { apiRouter } from "./routes/index.js";
import { logger } from "./utils/logger.js";
import { initSocket } from "./socket.js";
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
  app.use("/api", apiRouter);

  app.use(errorHandler);

  const server = http.createServer(app);
  
  // Initialize Socket.IO with the same CORS configuration as Express
  initSocket(server, { origin: env.frontendUrl, credentials: true });

  server.listen(env.port, () => {
    logger.info(`Server listening on http://localhost:${env.port}`);
  });
}

bootstrap().catch((err) => {
  logger.error("Failed to bootstrap:", err);
  process.exit(1);
});
