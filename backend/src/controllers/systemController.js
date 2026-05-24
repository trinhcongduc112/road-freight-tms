import mongoose from "mongoose";
import { Organization } from "../models/Organization.js";
import { RoleGroup } from "../models/RoleGroup.js";
import { User } from "../models/User.js";
import { getPerfSnapshot } from "../middlewares/perfMonitor.js";

/**
 * GET /api/system/health
 * Trả thông tin runtime: MongoDB connection + collection counts.
 * Public endpoint nhẹ — không lộ secret.
 */
export async function systemHealth(_req, res) {
  const conn = mongoose.connection;
  const stateMap = { 0: "disconnected", 1: "connected", 2: "connecting", 3: "disconnecting" };

  const [orgCount, roleCount, userCount] = await Promise.all([
    Organization.estimatedDocumentCount(),
    RoleGroup.estimatedDocumentCount(),
    User.estimatedDocumentCount()
  ]);

  let mongoVersion = null;
  let dbStats = null;
  try {
    const admin = conn.db.admin();
    const info = await admin.serverInfo();
    mongoVersion = info.version;
    dbStats = await conn.db.stats();
  } catch {
    // ignore — chỉ là metadata
  }

  res.json({
    success: true,
    data: {
      mongo: {
        state: stateMap[conn.readyState] ?? "unknown",
        host: conn.host,
        port: conn.port,
        database: conn.name,
        version: mongoVersion,
        collections: dbStats?.collections,
        dataSizeBytes: dbStats?.dataSize,
        storageSizeBytes: dbStats?.storageSize
      },
      counts: {
        organizations: orgCount,
        roleGroups: roleCount,
        users: userCount
      },
      backend: {
        nodeVersion: process.version,
        uptimeSeconds: Math.round(process.uptime()),
        env: process.env.NODE_ENV ?? "development"
      }
    }
  });
}

/**
 * GET /api/system/metrics
 * Snapshot p50/p95/p99 + slow endpoints — ISO 25010 mục 1.1 (Performance).
 * Public-readable nhẹ; nếu cần private có thể bọc auth sau.
 */
export async function systemMetrics(_req, res) {
  res.json({ success: true, data: getPerfSnapshot() });
}
