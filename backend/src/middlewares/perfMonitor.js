/**
 * Performance monitor — ISO 25010 mục 1.1:
 * - Đo response time mọi request /api/*.
 * - Log WARN khi vượt ngưỡng (default 500ms).
 * - Lưu rolling stats trong-process để endpoint /api/system/metrics có thể trả tóm tắt p50/p95/p99.
 *
 * Không ghi DB, không gửi đi đâu — tránh phình storage và phụ thuộc ngoài.
 */
import { logger } from "../utils/logger.js";

const SLOW_THRESHOLD_MS = Number(process.env.PERF_SLOW_THRESHOLD_MS ?? 500);
const WINDOW_SIZE = 1000;            // Lưu tối đa 1000 sample gần nhất
const samples = []; // { method, path, status, durationMs, ts }

function percentile(sortedArr, p) {
  if (sortedArr.length === 0) return 0;
  const idx = Math.min(sortedArr.length - 1, Math.floor((p / 100) * sortedArr.length));
  return sortedArr[idx];
}

export function perfMonitor() {
  return (req, res, next) => {
    const start = process.hrtime.bigint();
    res.on("finish", () => {
      const durationNs = process.hrtime.bigint() - start;
      const durationMs = Number(durationNs) / 1_000_000;

      const record = {
        method: req.method,
        path: req.route?.path || req.originalUrl.split("?")[0] || req.path,
        status: res.statusCode,
        durationMs: Math.round(durationMs * 10) / 10,
        ts: Date.now()
      };
      samples.push(record);
      if (samples.length > WINDOW_SIZE) samples.shift();

      if (durationMs > SLOW_THRESHOLD_MS) {
        logger.warn(`[perf] SLOW ${record.method} ${record.path} ${record.status} ${record.durationMs}ms`);
      }
    });
    next();
  };
}

/**
 * Trả tóm tắt p50/p95/p99 + slowest endpoints trong cửa sổ gần nhất.
 * Dùng cho endpoint /api/system/metrics.
 */
export function getPerfSnapshot() {
  if (samples.length === 0) {
    return { sampleCount: 0, p50: 0, p95: 0, p99: 0, slowest: [], slowCount: 0, threshold: SLOW_THRESHOLD_MS };
  }
  const durations = samples.map((s) => s.durationMs).sort((a, b) => a - b);
  const slowCount = samples.filter((s) => s.durationMs > SLOW_THRESHOLD_MS).length;
  const slowest = [...samples]
    .sort((a, b) => b.durationMs - a.durationMs)
    .slice(0, 10)
    .map((s) => ({ method: s.method, path: s.path, status: s.status, durationMs: s.durationMs }));

  return {
    sampleCount: samples.length,
    threshold: SLOW_THRESHOLD_MS,
    p50: percentile(durations, 50),
    p95: percentile(durations, 95),
    p99: percentile(durations, 99),
    slowCount,
    slowRatio: Math.round((slowCount / samples.length) * 1000) / 10,
    slowest
  };
}
