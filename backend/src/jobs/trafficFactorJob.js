/**
 * trafficFactorJob — chạy nền (no external scheduler dependency).
 *
 * - Khi server khởi động: seed defaults cho mọi org chưa có.
 * - Định kỳ 24h: với mỗi org, recompute factor từ lịch sử Trip 30 ngày gần nhất.
 *   (Nhỏ hơn 1 tuần để demo nhanh; thực tế nên 7d. Cấu hình bằng env nếu cần.)
 *
 * Triết lý: setInterval đơn giản, không cần thêm dependency. Process restart sẽ
 * reschedule lại — chấp nhận được vì job idempotent.
 */
import { Organization } from "../models/Organization.js";
import { seedDefaults, recomputeFromHistory } from "../services/trafficFactorService.js";
import { logger } from "../utils/logger.js";

const RECOMPUTE_INTERVAL_MS = 24 * 60 * 60 * 1000; // 24h
const INITIAL_DELAY_MS = 30 * 1000;                // 30s sau khi server start

async function seedAllOrgs() {
  const orgs = await Organization.find({}, { _id: 1 }).lean();
  let created = 0;
  for (const org of orgs) {
    const r = await seedDefaults(org._id);
    if (!r.skipped) created += r.created;
  }
  if (created > 0) logger.info(`[trafficFactor] seeded ${created} default factor records`);
}

async function recomputeAllOrgs() {
  const orgs = await Organization.find({}, { _id: 1 }).lean();
  for (const org of orgs) {
    try {
      const r = await recomputeFromHistory(org._id);
      if (r.updated > 0) {
        logger.info(`[trafficFactor] org=${org._id} updated ${r.updated} buckets (${r.sampleSize} samples)`);
      }
    } catch (err) {
      logger.error(`[trafficFactor] recompute failed for org=${org._id}: ${err.message}`);
    }
  }
}

export function startTrafficFactorJob() {
  setTimeout(async () => {
    try { await seedAllOrgs(); } catch (err) { logger.error(`[trafficFactor] seed failed: ${err.message}`); }
    try { await recomputeAllOrgs(); } catch (err) { logger.error(`[trafficFactor] initial recompute failed: ${err.message}`); }
  }, INITIAL_DELAY_MS);

  setInterval(() => {
    recomputeAllOrgs().catch((err) => logger.error(`[trafficFactor] periodic recompute failed: ${err.message}`));
  }, RECOMPUTE_INTERVAL_MS).unref?.();
}
