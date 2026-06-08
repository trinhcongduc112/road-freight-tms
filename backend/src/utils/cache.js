import Redis from "ioredis";
import { env } from "../config/env.js";
import { logger } from "./logger.js";

/* Cache layer dùng Redis — wrap GET endpoint để giảm 70-80% query MongoDB.
 *
 * Thiết kế:
 *   - Nếu env.redisUrl rỗng → mọi function no-op (fallback an toàn, backend vẫn chạy).
 *   - Key format: "v1:<orgId>:<resource>:<urlPath+query>"  (versioned để bust toàn bộ dễ).
 *   - TTL ngắn (30s default) để data không bị stale lâu.
 *   - Invalidate theo pattern khi POST/PUT/DELETE cùng resource.
 *
 * KHÔNG cache:
 *   - Endpoint nhạy cảm (login, register) — vì mỗi response unique
 *   - Endpoint trả binary (export Excel/PDF) — payload lớn ăn RAM Redis
 *   - Endpoint thay đổi state (POST/PUT/DELETE) — đương nhiên
 */

let redis = null;

export function getRedis() {
  if (!env.redisUrl) return null;
  if (redis) return redis;
  redis = new Redis(env.redisUrl, {
    // Connect ngay (không lazy). Cho phép offline queue để rate-limit-redis
    // có thể loadIncrementScript trong constructor mà không cần đợi ready.
    maxRetriesPerRequest: 2
  });
  let warned = false;
  redis.on("error", (err) => {
    // Chỉ log 1 lần để tránh spam khi Redis xuống
    if (!warned) {
      logger.warn(`[redis] ${err.message} — chạy không cache cho đến khi Redis sẵn sàng`);
      warned = true;
    }
  });
  redis.on("ready", () => {
    logger.info(`[redis] Connected to ${env.redisUrl}`);
    warned = false;
  });
  return redis;
}

function buildCacheKey(req) {
  const orgId = req.role?.OrganizationID ?? req.user?.OrganizationIDs?.[0] ?? "anon";
  // resource là phần đầu của path sau /api/ — vd /api/orders?page=1 → resource="orders"
  const resource = String(req.baseUrl || "").replace(/^\/api\//, "").split("/")[0] || "root";
  return `v1:${orgId}:${resource}:${req.originalUrl}`;
}

/**
 * Express middleware: cache response của GET endpoint trong Redis.
 * @param {number} ttlSeconds  Time-to-live, default 30s. Master data ít đổi có thể set 300s.
 * @returns Express middleware
 *
 * Cách dùng:
 *   router.get("/orders", cacheMiddleware(30), listOrders);
 */
export function cacheMiddleware(ttlSeconds = 30) {
  return async (req, res, next) => {
    // Chỉ cache GET, bỏ qua nếu method khác hoặc Redis down
    if (req.method !== "GET") return next();
    const client = getRedis();
    if (!client || client.status !== "ready") return next();

    const key = buildCacheKey(req);

    try {
      const cached = await client.get(key);
      if (cached) {
        res.setHeader("X-Cache", "HIT");
        res.setHeader("Content-Type", "application/json; charset=utf-8");
        return res.send(cached);
      }
    } catch (err) {
      // Lỗi Redis không được làm hỏng request → next() chạy bình thường
      return next();
    }

    // Cache MISS: intercept res.json để lưu response trước khi gửi
    res.setHeader("X-Cache", "MISS");
    const originalJson = res.json.bind(res);
    res.json = (body) => {
      try {
        const payload = JSON.stringify(body);
        // SETEX không chờ — fire and forget, tránh chậm response chính
        client.setex(key, ttlSeconds, payload).catch(() => {});
      } catch { /* không serialize được — bỏ qua cache */ }
      return originalJson(body);
    };
    next();
  };
}

/**
 * Invalidate (xoá) toàn bộ cache key của 1 resource trong 1 org.
 * Gọi sau POST/PUT/DELETE để client request sau đọc data mới.
 *
 * @param {string} orgId
 * @param {string} resource  vd "orders", "users", "master-data"
 */
export async function invalidateCache(orgId, resource) {
  const client = getRedis();
  if (!client || client.status !== "ready") return;
  const pattern = `v1:${orgId}:${resource}:*`;
  try {
    // SCAN + DEL theo batch — KHÔNG dùng KEYS (block Redis với nhiều key)
    const stream = client.scanStream({ match: pattern, count: 100 });
    const pipeline = client.pipeline();
    let count = 0;
    for await (const keys of stream) {
      if (keys.length) {
        keys.forEach((k) => pipeline.del(k));
        count += keys.length;
      }
    }
    if (count > 0) await pipeline.exec();
  } catch (err) {
    logger.warn(`[cache] invalidate ${pattern} failed: ${err.message}`);
  }
}

/**
 * Flush MỌI cache key của 1 org. Dùng sau bulk operation (seed demo, clear demo,
 * import Excel hàng loạt) — chứ không phải fire từng `invalidateCache(orgId, resource)`.
 *
 * @param {string} orgId
 */
export async function flushOrgCache(orgId) {
  const client = getRedis();
  if (!client || client.status !== "ready") return;
  const pattern = `v1:${orgId}:*`;
  try {
    const stream = client.scanStream({ match: pattern, count: 200 });
    const pipeline = client.pipeline();
    let count = 0;
    for await (const keys of stream) {
      if (keys.length) {
        keys.forEach((k) => pipeline.del(k));
        count += keys.length;
      }
    }
    if (count > 0) {
      await pipeline.exec();
      logger.info(`[cache] flushed ${count} keys for org ${orgId}`);
    }
  } catch (err) {
    logger.warn(`[cache] flushOrgCache failed: ${err.message}`);
  }
}

/**
 * Express middleware: invalidate cache của resource hiện tại sau write request.
 * Dùng cho POST/PUT/PATCH/DELETE — đặt SAU controller (express trigger middleware sau res.end).
 *
 * Cách dùng:
 *   router.post("/orders", createOrder, invalidateAfterWrite("orders"));
 */
export function invalidateAfterWrite(resource) {
  return (req, res, next) => {
    if (req.method === "GET") return next();
    res.on("finish", () => {
      // Chỉ invalidate nếu request thành công (2xx)
      if (res.statusCode >= 200 && res.statusCode < 300) {
        const orgId = req.role?.OrganizationID ?? req.user?.OrganizationIDs?.[0] ?? "anon";
        invalidateCache(orgId, resource).catch(() => {});
      }
    });
    next();
  };
}
